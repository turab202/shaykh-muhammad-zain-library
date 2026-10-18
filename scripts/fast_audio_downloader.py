# -*- coding: utf-8 -*-
"""
Fast concurrent audio downloader.
Session 1 (importer.session)  = GitHub Actions
Session 2 (importer2.session) = Local machine

Usage:
    py scripts/fast_audio_downloader.py --session 2             # local (small files only)
    py scripts/fast_audio_downloader.py --session 1             # GitHub Actions (all files)
    py scripts/fast_audio_downloader.py --session 2 --all       # local (all files including large)
"""
import sys, os, asyncio, argparse, time, secrets, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from _neon import connect
from telegram.importer.storage import get_storage

API_ID    = int(os.environ["TELEGRAM_API_ID"])
CHANNEL   = os.environ.get("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")
_API_HASH = os.environ["TELEGRAM_API_HASH"]
SESSION1  = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer")
SESSION2  = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2")

# Series with large files that need stable connection (GitHub Actions only)
LARGE_FILE_SERIES = {
    'ar-raheeq-al-makhtum',   # seerah ~12MB avg
    'sunan-abi-dawud',        # long hadith lessons
    'daaamim-manhaj-an-nubuwwah',
    'sharh-al-aqeedah-al-tahawiyyah',
}


def get_missing_lessons(limit: int, small_only: bool = False) -> list:
    conn = connect()
    cur = conn.cursor()

    if small_only:
        # Skip large-file series — let GitHub Actions handle them
        exclude = "AND s.slug NOT IN ({})".format(
            ",".join(f"'{s}'" for s in LARGE_FILE_SERIES)
        )
        print("Mode: small files only (skipping large series)", flush=True)
    else:
        exclude = ""
        print("Mode: all files", flush=True)

    cur.execute(f"""
        SELECT l.id, tm."messageId", tm."audioFilename", s.slug
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
          {exclude}
        ORDER BY s.slug, tm."messageId"
        LIMIT {int(limit)}
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    print(f"Found {len(rows)} lessons needing audio", flush=True)
    return rows


def save_audio_record(lesson_id, filename, storage_key, size, duration):
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
        """, (media_id, filename, size, duration, storage_key, lesson_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"  DB error: {e}", flush=True)
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


async def download_audio(limit: int, session_path: str, small_only: bool):
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated
    from mutagen import File as MutagenFile

    missing = get_missing_lessons(limit, small_only)
    if not missing:
        print("All lessons have audio!", flush=True)
        return

    storage = get_storage(provider=os.environ.get("STORAGE_PROVIDER", "B2"))
    msg_lookup = {row[1]: row for row in missing}
    msg_ids_list = sorted(msg_lookup.keys())

    print(f"Session: {Path(session_path).name}", flush=True)
    print(f"Downloading {len(msg_ids_list)} lessons...\n", flush=True)

    client = TelegramClient(
        session_path, API_ID, _API_HASH,
        connection=ConnectionTcpObfuscated,
        connection_retries=5, timeout=120, use_ipv6=False,
    )
    await client.start()
    me = await client.get_me()
    print(f"Authorized: {me.first_name}", flush=True)
    entity = await client.get_entity(CHANNEL)
    print(f"Channel ready\n", flush=True)

    downloaded = 0
    failed = 0
    skipped = 0
    semaphore = asyncio.Semaphore(2)

    async def download_one(msg):
        nonlocal downloaded, failed, skipped
        if msg is None:
            skipped += 1
            return
        msg_id = msg.id
        if msg_id not in msg_lookup:
            skipped += 1
            return
        lesson_id, _, filename, slug = msg_lookup[msg_id]
        if not (msg.document or msg.audio):
            skipped += 1
            return

        fn = str(filename)
        total = downloaded + failed + skipped + 1
        print(f"  [{total}/{len(msg_ids_list)}] ↓ {fn[:50]}", flush=True)

        async with semaphore:
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                    tmp_path = tmp.name

                # 8 minute timeout per file
                await asyncio.wait_for(client.download_media(msg, tmp_path), timeout=480)

                file_size = os.path.getsize(tmp_path)
                duration = 0
                try:
                    info = MutagenFile(tmp_path)
                    if info and hasattr(info.info, 'length'):
                        duration = int(info.info.length)
                except Exception:
                    pass

                # Retry B2 upload 3 times
                storage_key = None
                for attempt in range(3):
                    try:
                        storage_key = storage.save(
                            source_path=tmp_path,
                            original_filename=fn,
                            mime_type="audio/mpeg",
                        )
                        break
                    except Exception as e:
                        if attempt < 2:
                            print(f"    ⚠ B2 retry {attempt+1}: {e}", flush=True)
                            await asyncio.sleep(5)
                        else:
                            raise e

                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                tmp_path = None

                if storage_key and save_audio_record(lesson_id, fn, storage_key, file_size, duration):
                    downloaded += 1
                    print(f"    ✓ {fn[:45]} ({file_size//1024}KB)", flush=True)
                else:
                    failed += 1

            except asyncio.TimeoutError:
                print(f"    ✗ {fn[:40]} TIMEOUT (file too large for connection)", flush=True)
                failed += 1
                if tmp_path and os.path.exists(tmp_path):
                    try: os.unlink(tmp_path)
                    except: pass
            except Exception as e:
                print(f"    ✗ {fn[:40]} Error: {e}", flush=True)
                failed += 1
                if tmp_path and os.path.exists(tmp_path):
                    try: os.unlink(tmp_path)
                    except: pass

    chunk_size = 50
    for i in range(0, len(msg_ids_list), chunk_size):
        chunk = msg_ids_list[i:i + chunk_size]
        try:
            messages = await client.get_messages(entity, ids=chunk)
        except Exception as e:
            print(f"  Error fetching chunk: {e}", flush=True)
            await asyncio.sleep(10)
            continue

        await asyncio.gather(*[download_one(msg) for msg in messages])

        total_done = downloaded + failed + skipped
        remaining = len(msg_ids_list) - total_done
        print(f"\n  ── ✓{downloaded} done | ✗{failed} failed | {remaining} remaining ──\n", flush=True)

        if i + chunk_size < len(msg_ids_list):
            await asyncio.sleep(3)

    await client.disconnect()
    print(f"\nDONE: {downloaded} downloaded, {failed} failed", flush=True)


def main():
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=2000)
    parser.add_argument("--session", choices=["1", "2"], default="2")
    parser.add_argument("--all", action="store_true",
                        help="Download all files including large ones (default: skip large series locally)")
    args = parser.parse_args()

    session = SESSION1 if args.session == "1" else SESSION2
    # Local (session2) skips large files by default; GitHub Actions (session1) downloads everything
    small_only = (args.session == "2") and not args.all

    asyncio.run(download_audio(args.limit, session, small_only))


if __name__ == "__main__":
    main()
