# -*- coding: utf-8 -*-
"""
Fast targeted audio downloader.
Gets the exact list of TG message IDs that need audio, downloads them
directly without running the full importer pipeline each time.

Usage:
    py scripts/fast_audio_downloader.py              # download all missing
    py scripts/fast_audio_downloader.py --limit 50   # download first 50
"""
import sys, os, asyncio, argparse, time, secrets, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from _neon import connect
from telegram.importer.storage import get_storage

# ─── Config ─────────────────────────────────────────────────────────────────
API_ID    = int(os.environ["TELEGRAM_API_ID"])
CHANNEL   = os.environ.get("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")
SESSION   = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer")
_API_HASH = os.environ["TELEGRAM_API_HASH"]


def get_missing_lessons(limit: int) -> list:
    """Get list of (lesson_id, msg_id, filename) for lessons without audio."""
    conn = connect()
    cur = conn.cursor()
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
        ORDER BY s.slug, tm."messageId"
        LIMIT {int(limit)}
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    print(f"Found {len(rows)} lessons needing audio")
    return rows  # each row: (lesson_id, msg_id, filename, slug)


def save_audio_record(lesson_id: str, filename: str, storage_key: str,
                      size: int, duration: int):
    """Create a media record linking the downloaded audio to the lesson."""
    conn = connect()
    cur = conn.cursor()
    media_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
    # storage_key is already in s3://bucket/key format from S3Storage.save()
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
        print(f"  DB error: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


async def download_audio(limit: int):
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated
    from mutagen.mp3 import MP3
    from mutagen import File as MutagenFile

    missing = get_missing_lessons(limit)
    if not missing:
        print("All lessons have audio!")
        return

    storage = get_storage(
        provider=os.environ.get("STORAGE_PROVIDER", "B2"),
    )

    # Build msgId → (lesson_id, filename, slug) lookup
    msg_lookup = {row[1]: row for row in missing}
    msg_ids_needed = set(msg_lookup.keys())

    client = TelegramClient(
        SESSION, API_ID, _API_HASH,
        connection=ConnectionTcpObfuscated,
        connection_retries=5, timeout=60, use_ipv6=False,
    )

    print(f"Connecting to Telegram...")
    await client.start()
    me = await client.get_me()
    print(f"Authorized as: {me.first_name} (id={me.id})")

    entity = await client.get_entity(CHANNEL)
    print(f"Channel: {getattr(entity, 'title', CHANNEL)} (id={entity.id})")

    downloaded = 0
    failed = 0
    skipped = 0

    # Process messages in batches of 50 by message ID
    msg_ids_list = sorted(msg_ids_needed)
    print(f"\nDownloading {len(msg_ids_list)} audio files...\n", flush=True)

    semaphore = asyncio.Semaphore(3)  # 3 concurrent downloads

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

        if not msg.document and not msg.audio:
            skipped += 1
            return

        doc = msg.document or msg.audio
        if not doc:
            skipped += 1
            return

        print(f"  ↓ [{downloaded+failed+skipped+1}/{len(msg_ids_list)}] msgId={msg_id} {str(filename)[:45]}", flush=True)

        async with semaphore:
            try:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                    tmp_path = tmp.name

                await client.download_media(msg, tmp_path)

                file_size = os.path.getsize(tmp_path)
                duration = 0
                try:
                    audio_info = MutagenFile(tmp_path)
                    if audio_info and hasattr(audio_info.info, 'length'):
                        duration = int(audio_info.info.length)
                except Exception:
                    pass

                fn = str(filename)
                storage_key = storage.save(
                    source_path=tmp_path,
                    original_filename=fn,
                    mime_type="audio/mpeg",
                )
                os.unlink(tmp_path)

                if save_audio_record(lesson_id, fn, storage_key, file_size, duration):
                    downloaded += 1
                    print(f"    ✓ {fn[:40]} ({file_size//1024}KB, {duration}s)", flush=True)
                else:
                    failed += 1

            except Exception as e:
                print(f"    ✗ msgId={msg_id} Error: {e}", flush=True)
                failed += 1
                try: os.unlink(tmp_path)
                except Exception: pass

    # Fetch messages in chunks of 50, download concurrently within each chunk
    chunk_size = 50
    for i in range(0, len(msg_ids_list), chunk_size):
        chunk = msg_ids_list[i:i + chunk_size]

        try:
            messages = await client.get_messages(entity, ids=chunk)
        except Exception as e:
            print(f"  Error fetching chunk {i//chunk_size + 1}: {e}", flush=True)
            failed += len(chunk)
            await asyncio.sleep(5)
            continue

        # Download all messages in this chunk concurrently
        tasks = [download_one(msg) for msg in messages]
        await asyncio.gather(*tasks)

        total_done = downloaded + failed + skipped
        print(f"\n  ── Chunk {i//chunk_size + 1}: {downloaded} downloaded | {failed} failed | {skipped} skipped | {len(msg_ids_list)-total_done} remaining ──\n", flush=True)

        # Brief pause between chunks
        if i + chunk_size < len(msg_ids_list):
            await asyncio.sleep(2)

    await client.disconnect()

    print(f"\n{'='*55}", flush=True)
    print(f"DONE: {downloaded} downloaded, {failed} failed, {skipped} skipped", flush=True)


def main():
    # Force UTF-8 output
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=2000,
                        help="Max lessons to download (default: all)")
    args = parser.parse_args()

    asyncio.run(download_audio(args.limit))


if __name__ == "__main__":
    main()
