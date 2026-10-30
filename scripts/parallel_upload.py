# -*- coding: utf-8 -*-
"""
FAST parallel uploader:
- Downloads 5 files simultaneously from Telegram 
- Uploads 5 files simultaneously to archive.org
- Skips failed files automatically
- Auto-reconnects on network drops
"""
import sys, os, asyncio, time, secrets, tempfile, threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import queue

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from _neon import connect

IA_ACCESS   = os.environ.get("IA_ACCESS_KEY", "")
IA_SECRET   = os.environ.get("IA_SECRET_KEY", "")
ITEM_PREFIX = "shaykh-muhammad-zain"

_lock = threading.Lock()
_done = 0
_total = 0

def log(msg):
    with _lock: print(msg, flush=True)

def get_missing(limit=5000):
    conn = connect(); cur = conn.cursor()
    cur.execute(f"""
        SELECT l.id, tm."messageId", tm."audioFilename", s.slug, s.title
        FROM lessons l
        JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
        JOIN series s ON s.id = l."seriesId"
        LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
        WHERE l.status='PUBLISHED' AND m.id IS NULL
          AND tm."audioFilename" IS NOT NULL
          AND lower(tm."audioFilename") NOT LIKE '%.pdf'
          AND lower(tm."audioFilename") NOT LIKE '%.webp'
          AND lower(tm."audioFilename") NOT LIKE '%.apk'
        ORDER BY s.slug, tm."messageId"
        LIMIT {limit}
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    return rows

def save_db(lesson_id, fn, ia_url, size, duration):
    conn = connect(); cur = conn.cursor()
    mid = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
    try:
        cur.execute("""
            INSERT INTO media (id,filename,"mimeType",size,duration,
                "mediaType","storageKey","storageProvider","lessonId","createdAt")
            VALUES(%s,%s,'audio/mpeg',%s,%s,'AUDIO'::"MediaType",
                %s,'S3'::"StorageProvider",%s,NOW()) ON CONFLICT DO NOTHING
        """, (mid, fn, size, duration, ia_url, lesson_id))
        conn.commit(); return True
    except: conn.rollback(); return False
    finally: cur.close(); conn.close()

def upload_worker(args):
    """Upload one file to archive.org in a thread."""
    global _done
    lesson_id, fn, tmp_path, series_slug, series_title = args
    import urllib.parse
    from internetarchive import upload as ia_up
    from mutagen import File as MF

    item_id = f"{ITEM_PREFIX}-{series_slug}"
    safe_fn  = urllib.parse.quote(fn.replace(" ", "_"), safe=".-_")

    for attempt in range(3):
        try:
            ia_up(item_id, files={safe_fn: tmp_path},
                metadata={"title": f"Shaykh Muhammad Zain",
                          "creator": "Shaykh Muhammad Zain", "language": "ara",
                          "mediatype": "audio", "collection": "opensource_audio"},
                access_key=IA_ACCESS, secret_key=IA_SECRET,
                verbose=False, retries=2)

            size = os.path.getsize(tmp_path)
            dur  = 0
            try:
                info = MF(tmp_path)
                if info and hasattr(info.info, 'length'): dur = int(info.info.length)
            except: pass

            ia_url = f"https://archive.org/download/{item_id}/{safe_fn}"
            if save_db(lesson_id, fn, ia_url, size, dur):
                with _lock:
                    _done += 1
                    log(f"  ✓ [{_done}/{_total}] {fn[:50]}")
                try: os.unlink(tmp_path)
                except: pass
                return True
        except Exception as e:
            if attempt < 2:
                time.sleep(5 * (attempt + 1))
            else:
                log(f"  ✗ {fn[:40]} upload failed: {str(e)[:60]}")
    try: os.unlink(tmp_path)
    except: pass
    return False

async def download_all(missing):
    """Download all files from Telegram concurrently."""
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2")
    API_ID  = int(os.environ["TELEGRAM_API_ID"])
    _HASH   = os.environ["TELEGRAM_API_HASH"]
    CHANNEL = os.environ.get("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")
    PHONE   = os.environ.get("TELEGRAM_PHONE", "")

    client = TelegramClient(SESSION, API_ID, _HASH,
        connection=ConnectionTcpObfuscated, connection_retries=10,
        timeout=60, request_retries=5, use_ipv6=False)

    log("Connecting to Telegram...")
    await client.start(phone=PHONE if PHONE else None)
    log(f"Authorized: {(await client.get_me()).first_name}")
    entity = await client.get_entity(CHANNEL)
    log(f"Channel ready. Downloading {len(missing)} files...\n")

    msg_lookup = {row[1]: row for row in missing}
    msg_ids    = sorted(msg_lookup.keys())
    downloaded = []  # list of (lesson_id, fn, tmp_path, slug, title)
    dl_failed  = 0

    # Download 5 at a time
    sem = asyncio.Semaphore(5)

    async def dl_one(msg):
        nonlocal dl_failed
        if msg is None: return
        if msg.id not in msg_lookup: return
        lesson_id, _, fn, slug, title = msg_lookup[msg.id]
        fn = str(fn)
        if not (msg.document or msg.audio): return

        async with sem:
            tmp = tempfile.mktemp(suffix=".mp3")
            try:
                await asyncio.wait_for(client.download_media(msg, tmp), timeout=90)
                downloaded.append((lesson_id, fn, tmp, slug, title))
                log(f"  ↓ {fn[:55]}")
            except Exception as e:
                dl_failed += 1
                log(f"  ✗ dl {fn[:40]}: {type(e).__name__}")
                try: os.unlink(tmp)
                except: pass

    # Process in chunks of 50
    chunk = 50
    for i in range(0, len(msg_ids), chunk):
        batch_ids = msg_ids[i:i+chunk]
        try:
            msgs = await client.get_messages(entity, ids=batch_ids)
        except Exception as e:
            log(f"  Fetch error: {e}")
            await asyncio.sleep(10)
            continue
        await asyncio.gather(*[dl_one(m) for m in msgs])
        log(f"\n  Downloaded {len(downloaded)} | Failed {dl_failed} | Remaining {len(msg_ids)-i-chunk}\n")

    await client.disconnect()
    return downloaded, dl_failed

async def main():
    global _total
    if not IA_ACCESS or not IA_SECRET:
        print("ERROR: IA_ACCESS_KEY and IA_SECRET_KEY not set in .env"); return

    missing = get_missing()
    if not missing:
        print("All lessons have audio!"); return

    _total = len(missing)
    print(f"Found {_total} lessons needing audio\n", flush=True)

    # Phase 1: Download all from Telegram
    print("=== PHASE 1: Downloading from Telegram ===", flush=True)
    downloaded, dl_failed = await download_all(missing)
    print(f"\nDownloaded: {len(downloaded)} | Failed: {dl_failed}", flush=True)

    if not downloaded:
        print("Nothing downloaded."); return

    # Phase 2: Upload all to archive.org in parallel (5 workers)
    print(f"\n=== PHASE 2: Uploading {len(downloaded)} files to archive.org ===", flush=True)
    upload_ok = 0
    upload_fail = 0

    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(upload_worker, args): args[1] for args in downloaded}
        for fut in as_completed(futures):
            fn = futures[fut]
            try:
                if fut.result(): upload_ok += 1
                else: upload_fail += 1
            except Exception as e:
                upload_fail += 1
                log(f"  ✗ {fn[:40]}: {e}")

    print(f"\n{'='*50}", flush=True)
    print(f"DONE: {upload_ok} uploaded, {upload_fail} failed, {dl_failed} download failed", flush=True)

if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    asyncio.run(main())
