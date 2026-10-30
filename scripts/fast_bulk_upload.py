# -*- coding: utf-8 -*-
"""
FASTEST upload approach:
Phase 1: Download ALL audio files from Telegram to local disk (fast - Telegram is fast)
Phase 2: Upload all files to archive.org in parallel (5 workers)

This separates the two operations so neither blocks the other.
"""
import sys, os, asyncio, time, secrets, tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import threading

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from _neon import connect

IA_ACCESS  = os.environ.get("IA_ACCESS_KEY", "")
IA_SECRET  = os.environ.get("IA_SECRET_KEY", "")
ITEM_PREFIX = "shaykh-muhammad-zain"
DOWNLOAD_DIR = Path(tempfile.gettempdir()) / "zain_audio_cache"
DOWNLOAD_DIR.mkdir(exist_ok=True)

print_lock = threading.Lock()
def log(msg): 
    with print_lock: print(msg, flush=True)


def get_missing_lessons(limit=5000):
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
        ORDER BY s.slug, tm."messageId"
        LIMIT {limit}
    """)
    rows = cur.fetchall(); cur.close(); conn.close()
    return rows


def save_record(lesson_id, filename, ia_url, size, duration):
    conn = connect(); cur = conn.cursor()
    mid = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
    try:
        cur.execute("""
            INSERT INTO media (id,filename,"mimeType",size,duration,
                "mediaType","storageKey","storageProvider","lessonId","createdAt")
            VALUES(%s,%s,'audio/mpeg',%s,%s,'AUDIO'::"MediaType",
                %s,'S3'::"StorageProvider",%s,NOW()) ON CONFLICT DO NOTHING
        """, (mid, filename, size, duration, ia_url, lesson_id))
        conn.commit(); return True
    except: conn.rollback(); return False
    finally: cur.close(); conn.close()


def upload_one(args):
    """Upload one file to archive.org. Runs in thread pool."""
    lesson_id, fn, tmp_path, series_slug, series_title = args
    from internetarchive import upload as ia_upload
    import urllib.parse

    item_id = f"{ITEM_PREFIX}-{series_slug}"
    safe_fn = urllib.parse.quote(fn.replace(" ", "_"), safe=".-_")

    try:
        ia_upload(item_id,
            files={safe_fn: tmp_path},
            metadata={
                "title": f"Shaykh Muhammad Zain - {series_title}",
                "creator": "Shaykh Muhammad Zain",
                "language": "ara", "mediatype": "audio",
                "collection": "opensource_audio",
            },
            access_key=IA_ACCESS, secret_key=IA_SECRET,
            verbose=False, retries=3)
        
        size = os.path.getsize(tmp_path)
        duration = 0
        try:
            from mutagen import File as MF
            info = MF(tmp_path)
            if info and hasattr(info.info, 'length'):
                duration = int(info.info.length)
        except: pass

        ia_url = f"https://archive.org/download/{item_id}/{safe_fn}"
        if save_record(lesson_id, fn, ia_url, size, duration):
            log(f"  ✓ {fn[:50]}")
            return True
    except Exception as e:
        log(f"  ✗ {fn[:40]}: {str(e)[:60]}")
    return False


async def main():
    if not IA_ACCESS or not IA_SECRET:
        print("ERROR: Set IA_ACCESS_KEY and IA_SECRET_KEY in .env"); return

    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    missing = get_missing_lessons()
    if not missing:
        print("All lessons have audio!"); return

    print(f"Found {len(missing)} lessons needing audio", flush=True)

    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2")
    API_ID  = int(os.environ["TELEGRAM_API_ID"])
    _HASH   = os.environ["TELEGRAM_API_HASH"]
    CHANNEL = os.environ.get("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")
    PHONE   = os.environ.get("TELEGRAM_PHONE", "")

    client = TelegramClient(SESSION, API_ID, _HASH,
        connection=ConnectionTcpObfuscated, connection_retries=5,
        timeout=120, use_ipv6=False)

    print("Connecting to Telegram...", flush=True)
    await client.start(phone=PHONE if PHONE else None)
    me = await client.get_me()
    print(f"Authorized: {me.first_name}", flush=True)
    entity = await client.get_entity(CHANNEL)
    print(f"Channel ready.\n", flush=True)

    msg_lookup = {row[1]: row for row in missing}
    msg_ids = sorted(msg_lookup.keys())

    downloaded = 0
    uploaded   = 0
    failed_dl  = 0
    failed_up  = 0

    # Upload pool - 5 workers for archive.org
    executor = ThreadPoolExecutor(max_workers=5)
    upload_futures = []

    print(f"Phase 1: Downloading from Telegram + Phase 2: Uploading to archive.org", flush=True)
    print(f"(Downloads happen sequentially, uploads in parallel)\n", flush=True)

    chunk_size = 20
    for i in range(0, len(msg_ids), chunk_size):
        chunk = msg_ids[i:i+chunk_size]
        try:
            messages = await client.get_messages(entity, ids=chunk)
        except Exception as e:
            log(f"Fetch error: {e}")
            failed_dl += len(chunk)
            await asyncio.sleep(5)
            continue

        for msg in messages:
            if msg is None or not (msg.document or msg.audio):
                failed_dl += 1; continue

            lesson_id, _, filename, series_slug, series_title = msg_lookup[msg.id]
            fn = str(filename)

            # Download to local cache
            tmp_path = str(DOWNLOAD_DIR / f"{msg.id}_{fn.replace('/', '_')}")
            try:
                await asyncio.wait_for(client.download_media(msg, tmp_path), timeout=300)
                downloaded += 1
                log(f"  ↓ [{downloaded}/{len(msg_ids)}] {fn[:50]}")
            except Exception as e:
                log(f"  ✗ download {fn[:40]}: {e}")
                failed_dl += 1
                continue

            # Submit upload to thread pool (non-blocking)
            fut = executor.submit(upload_one, (lesson_id, fn, tmp_path, series_slug, series_title))
            upload_futures.append((fut, tmp_path))

        # Check completed uploads and clean temp files
        still_pending = []
        for fut, tmp_path in upload_futures:
            if fut.done():
                if fut.result():
                    uploaded += 1
                else:
                    failed_up += 1
                try: os.unlink(tmp_path)
                except: pass
            else:
                still_pending.append((fut, tmp_path))
        upload_futures = still_pending

        total_done = downloaded + failed_dl
        log(f"\n  Progress: {uploaded} uploaded | {downloaded} downloaded | {failed_dl} dl_failed | {len(upload_futures)} uploading | {len(msg_ids)-total_done} remaining\n")
        await asyncio.sleep(1)

    # Wait for all remaining uploads to finish
    log(f"\nWaiting for {len(upload_futures)} remaining uploads...")
    for fut, tmp_path in upload_futures:
        try:
            if fut.result(timeout=300):
                uploaded += 1
            else:
                failed_up += 1
        except Exception as e:
            log(f"Upload error: {e}")
            failed_up += 1
        try: os.unlink(tmp_path)
        except: pass

    await client.disconnect()
    executor.shutdown(wait=False)

    print(f"\n{'='*55}", flush=True)
    print(f"DONE: {uploaded} uploaded, {failed_dl} download failed, {failed_up} upload failed", flush=True)


if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    asyncio.run(main())
