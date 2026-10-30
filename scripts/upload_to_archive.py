# -*- coding: utf-8 -*-
"""
FAST concurrent audio uploader to Internet Archive (archive.org).

Uses:
- Telegram download: 3 concurrent streams
- Archive.org upload: direct S3 API via requests (faster than ia library)
- 3 concurrent upload workers

Setup:
    IA_ACCESS_KEY and IA_SECRET_KEY in .env
    Get keys at: https://archive.org/account/s3.php

Usage:
    py scripts/upload_to_archive.py              # local (session2)
    py scripts/upload_to_archive.py --session 1  # GitHub Actions (session1)
    py scripts/upload_to_archive.py --limit 200  # limit files
"""
import sys, os, asyncio, argparse, time, secrets, tempfile, threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import queue

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from _neon import connect

IA_ACCESS  = os.environ.get("IA_ACCESS_KEY", "")
IA_SECRET  = os.environ.get("IA_SECRET_KEY", "")
IA_S3_HOST = "s3.us.archive.org"
ITEM_PREFIX = "shaykh-muhammad-zain"


def get_missing_lessons(limit: int) -> list:
    conn = connect()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT l.id, tm."messageId", tm."audioFilename", s.slug, s.title
        FROM lessons l
        JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
        JOIN series s ON s.id = l."seriesId"
        LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
        WHERE l.status = 'PUBLISHED'
          AND m.id IS NULL
          AND tm."audioFilename" IS NOT NULL
          AND lower(tm."audioFilename") NOT LIKE '%.pdf'
          AND lower(tm."audioFilename") NOT LIKE '%.webp'
          AND lower(tm."audioFilename") NOT LIKE '%.apk'
          AND s.slug != 'ar-raheeq-al-makhtum'  -- large files, handle separately
        ORDER BY s.slug, tm."messageId"
        LIMIT {int(limit)}
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    print(f"Found {len(rows)} lessons needing audio", flush=True)
    return rows


def save_ia_record(lesson_id, filename, ia_url, size, duration):
    conn = connect()
    cur = conn.cursor()
    media_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
    try:
        cur.execute("""
            INSERT INTO media (id, filename, "mimeType", size, duration,
                               "mediaType", "storageKey", "storageProvider",
                               "lessonId", "createdAt")
            VALUES (%s,%s,'audio/mpeg',%s,%s,'AUDIO'::"MediaType",
                    %s,'S3'::"StorageProvider",%s, NOW())
            ON CONFLICT DO NOTHING
        """, (media_id, filename, size, duration, ia_url, lesson_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"  DB error: {e}", flush=True)
        conn.rollback()
        return False
    finally:
        cur.close(); conn.close()


def upload_to_ia(tmp_path: str, item_id: str, safe_fn: str, series_title: str) -> str:
    """Upload file to archive.org using internetarchive library. Returns public URL."""
    from internetarchive import upload as ia_upload

    metadata = {
        "title": f"Shaykh Muhammad Zain - {series_title}",
        "creator": "Shaykh Muhammad Zain",
        "language": "ara",
        "mediatype": "audio",
        "collection": "opensource_audio",
        "subject": "Islam;Islamic lectures;Shaykh Muhammad Zain",
    }

    ia_upload(
        item_id,
        files={safe_fn: tmp_path},
        metadata=metadata,
        access_key=IA_ACCESS,
        secret_key=IA_SECRET,
        verbose=False,
        retries=3,
    )

    return f"https://archive.org/download/{item_id}/{safe_fn}"


async def run_upload(limit: int, session_num: str):
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated
    from mutagen import File as MutagenFile
    import urllib3
    urllib3.disable_warnings()

    if not IA_ACCESS or not IA_SECRET:
        print("ERROR: Set IA_ACCESS_KEY and IA_SECRET_KEY in .env", flush=True)
        print("Get keys at: https://archive.org/account/s3.php", flush=True)
        return

    missing = get_missing_lessons(limit)
    if not missing:
        print("All lessons have audio!", flush=True)
        return

    msg_lookup = {row[1]: row for row in missing}
    msg_ids = sorted(msg_lookup.keys())

    session_name = "importer" if session_num == "1" else "importer2"
    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / session_name)
    API_ID   = int(os.environ["TELEGRAM_API_ID"])
    _HASH    = os.environ["TELEGRAM_API_HASH"]
    CHANNEL  = os.environ.get("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")
    PHONE    = os.environ.get("TELEGRAM_PHONE", "")

    # Handle AuthKeyDuplicatedError by deleting session and re-authenticating
    for attempt in range(3):
        try:
            client = TelegramClient(SESSION, API_ID, _HASH,
                connection=ConnectionTcpObfuscated,
                connection_retries=3, timeout=120, use_ipv6=False)

            print(f"Connecting (session={session_name}, attempt {attempt+1})...", flush=True)
            await asyncio.sleep(2 * attempt)  # Back off on retries
            await client.start(phone=PHONE if PHONE else None)
            me = await client.get_me()
            print(f"Authorized: {me.first_name}", flush=True)
            break  # Success
        except Exception as e:
            err = str(e)
            if "AuthKeyDuplicated" in err or "AuthKeyNotFound" in err:
                print(f"Session conflict on attempt {attempt+1}, clearing session...", flush=True)
                # Delete the session file to force fresh auth key negotiation
                session_file = Path(SESSION + ".session")
                if session_file.exists():
                    try:
                        await client.disconnect()
                    except Exception:
                        pass
                    await asyncio.sleep(2)
                    try:
                        session_file.unlink()
                        print("Session cleared. Reconnecting...", flush=True)
                    except Exception:
                        pass
                if attempt == 2:
                    print("All attempts failed. Exiting.", flush=True)
                    return
            else:
                print(f"Connection error: {e}", flush=True)
                raise
    entity = await client.get_entity(CHANNEL)
    print(f"Channel ready. {len(msg_ids)} files to upload.\n", flush=True)

    downloaded = 0
    failed = 0
    skipped = 0
    lock = asyncio.Lock()

    # Thread pool for archive.org uploads (CPU-bound + network)
    executor = ThreadPoolExecutor(max_workers=3)

    async def process_one(msg):
        nonlocal downloaded, failed, skipped

        if msg is None:
            async with lock: skipped += 1
            return
        if msg.id not in msg_lookup:
            async with lock: skipped += 1
            return

        lesson_id, _, filename, series_slug, series_title = msg_lookup[msg.id]
        fn = str(filename)
        # URL-encode Arabic characters so they work in HTTP headers
        import urllib.parse
        safe_fn = urllib.parse.quote(fn.replace(" ", "_"), safe=".-_")
        item_id = f"{ITEM_PREFIX}-{series_slug}"

        async with lock:
            done = downloaded + failed + skipped + 1
        print(f"  [{done}/{len(msg_ids)}] {fn[:55]}", flush=True)

        tmp_path = None
        try:
            # 1. Download from Telegram
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp_path = tmp.name
            await asyncio.wait_for(client.download_media(msg, tmp_path), timeout=300)

            file_size = os.path.getsize(tmp_path)
            duration = 0
            try:
                info = MutagenFile(tmp_path)
                if info and hasattr(info.info, "length"):
                    duration = int(info.info.length)
            except Exception:
                pass

            # 2. Upload to archive.org S3 in thread (non-blocking)
            loop = asyncio.get_event_loop()
            ia_url = await loop.run_in_executor(
                executor,
                upload_to_ia, tmp_path, item_id, safe_fn, series_title
            )

            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
            tmp_path = None

            if save_ia_record(lesson_id, fn, ia_url, file_size, duration):
                async with lock: downloaded += 1
                print(f"    ✓ {fn[:50]}", flush=True)
            else:
                async with lock: failed += 1

        except Exception as e:
            async with lock: failed += 1
            err_msg = str(e).encode('ascii', errors='replace').decode('ascii')
            print(f"    ✗ {fn[:40]}: {type(e).__name__}: {err_msg[:80]}", flush=True)
            if tmp_path and os.path.exists(tmp_path):
                try: os.unlink(tmp_path)
                except: pass

    # Process in chunks of 30, 3 concurrent per chunk
    semaphore = asyncio.Semaphore(1)  # Sequential — Telegram bans concurrent connections from same session

    async def process_with_sem(msg):
        async with semaphore:
            await process_one(msg)

    chunk_size = 10
    for i in range(0, len(msg_ids), chunk_size):
        chunk = msg_ids[i:i + chunk_size]
        try:
            messages = await client.get_messages(entity, ids=chunk)
        except Exception as e:
            print(f"  Fetch error: {e}", flush=True)
            await asyncio.sleep(10)
            continue

        await asyncio.gather(*[process_with_sem(msg) for msg in messages])

        total_done = downloaded + failed + skipped
        remaining  = len(msg_ids) - total_done
        pct = downloaded * 100 // max(len(msg_ids), 1)
        print(f"\n  ── {pct}% | ✓{downloaded} uploaded | ✗{failed} failed | {remaining} remaining ──\n",
              flush=True)

        await asyncio.sleep(2)

    await client.disconnect()
    executor.shutdown(wait=False)
    print(f"\nDONE: {downloaded} uploaded to archive.org, {failed} failed", flush=True)


def main():
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                                  errors="replace", line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8",
                                  errors="replace", line_buffering=True)
    # Also set environment for subprocesses
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit",   type=int, default=5000)
    parser.add_argument("--test",    action="store_true")
    parser.add_argument("--session", choices=["1", "2"], default="2")
    args = parser.parse_args()

    if args.test:
        args.limit = 10

    asyncio.run(run_upload(args.limit, args.session))


if __name__ == "__main__":
    main()
