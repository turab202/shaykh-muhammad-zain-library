# -*- coding: utf-8 -*-
"""
Upload audio files to Internet Archive (archive.org) - completely FREE.

Internet Archive:
- No card required
- Unlimited storage
- Direct CDN URLs: https://archive.org/download/{identifier}/{filename}
- Perfect for Islamic educational content

Setup:
1. Sign up at https://archive.org/account/signup (free, just email)
2. Get S3 keys at https://archive.org/account/s3
3. Add to .env:
   IA_ACCESS_KEY=your_access_key
   IA_SECRET_KEY=your_secret_key

Usage:
    py scripts/upload_to_archive.py              # upload all missing
    py scripts/upload_to_archive.py --limit 100  # upload first 100
    py scripts/upload_to_archive.py --test       # test with 1 file

Each series gets its own Archive.org item, e.g.:
  shaykh-zain-bulugh-al-maram
  shaykh-zain-al-fawakeh
  etc.

Files are publicly accessible at:
  https://archive.org/download/shaykh-zain-{series-slug}/{filename}
"""
import sys, os, asyncio, argparse, time, secrets, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from _neon import connect

IA_ACCESS = os.environ.get("IA_ACCESS_KEY", "")
IA_SECRET = os.environ.get("IA_SECRET_KEY", "")
IA_BASE_URL = "https://archive.org/download"

# Archive.org item name prefix
ITEM_PREFIX = "shaykh-muhammad-zain"


def get_missing_lessons(limit: int) -> list:
    """Get lessons without audio (no B2 audio)."""
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
        ORDER BY s.slug, tm."messageId"
        LIMIT {int(limit)}
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    print(f"Found {len(rows)} lessons needing audio", flush=True)
    return rows


def get_or_create_ia_item(series_slug: str, series_title: str) -> str:
    """Get the archive.org item identifier for a series."""
    return f"{ITEM_PREFIX}-{series_slug}"


def save_ia_record(lesson_id: str, filename: str, ia_url: str, size: int, duration: int) -> bool:
    """Save archive.org URL as a media record."""
    conn = connect()
    cur = conn.cursor()
    media_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
    try:
        cur.execute("""
            INSERT INTO media (id, filename, "mimeType", size, duration,
                               "mediaType", "storageKey", "storageProvider",
                               "lessonId", "createdAt")
            VALUES (%s, %s, 'audio/mpeg', %s, %s,
                    'AUDIO'::"MediaType",
                    %s, 'S3'::"StorageProvider",
                    %s, NOW())
            ON CONFLICT DO NOTHING
        """, (media_id, filename, size, duration, ia_url, lesson_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"  DB error: {e}", flush=True)
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


async def upload_to_archive(limit: int, test_mode: bool = False, session_num: str = "2"):
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated
    from mutagen import File as MutagenFile
    from internetarchive import upload

    if not IA_ACCESS or not IA_SECRET:
        print("ERROR: IA_ACCESS_KEY and IA_SECRET_KEY not set in .env")
        print("1. Sign up at https://archive.org/account/signup")
        print("2. Get keys at https://archive.org/account/s3.php")
        print("3. Add to .env: IA_ACCESS_KEY=xxx and IA_SECRET_KEY=xxx")
        return

    missing = get_missing_lessons(limit)
    if not missing:
        print("All lessons have audio!", flush=True)
        return

    session_name = "importer" if session_num == "1" else "importer2"
    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / session_name)
    API_ID = int(os.environ["TELEGRAM_API_ID"])
    _API_HASH = os.environ["TELEGRAM_API_HASH"]
    CHANNEL = os.environ.get("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")
    print(f"Connecting to Telegram (session: {session_name})...", flush=True)
    client = TelegramClient(
        SESSION, API_ID, _API_HASH,
        connection=ConnectionTcpObfuscated,
        connection_retries=5, timeout=120, use_ipv6=False,
    )

    PHONE = os.environ.get("TELEGRAM_PHONE", "")
    await client.start(phone=PHONE if PHONE else None)
    me = await client.get_me()
    print(f"Authorized: {me.first_name}", flush=True)
    entity = await client.get_entity(CHANNEL)
    print(f"Channel ready. Uploading to archive.org...\n", flush=True)

    downloaded = 0
    failed = 0
    skipped = 0

    # Group by series for better IA organization
    msg_ids = [row[1] for row in missing]
    msg_lookup = {row[1]: row for row in missing}

    # Pre-created item identifiers per series
    created_items = set()

    async def upload_one(msg):
        nonlocal downloaded, failed, skipped
        if msg is None:
            skipped += 1
            return

        lesson_id, _, filename, series_slug, series_title = msg_lookup[msg.id]
        fn = str(filename)
        total = downloaded + failed + skipped + 1

        print(f"  [{total}/{len(msg_ids)}] ↓ {fn[:50]}", flush=True)

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp_path = tmp.name

            await asyncio.wait_for(client.download_media(msg, tmp_path), timeout=480)

            file_size = os.path.getsize(tmp_path)
            duration = 0
            try:
                info = MutagenFile(tmp_path)
                if info and hasattr(info.info, 'length'):
                    duration = int(info.info.length)
            except Exception:
                pass

            # Upload to Internet Archive
            item_id = get_or_create_ia_item(series_slug, series_title)

            # Create item metadata if first file for this series
            metadata = {
                "title": f"Shaykh Muhammad Zain — {series_title}",
                "description": f"Islamic audio lectures by Shaykh Muhammad Zain on {series_title}",
                "subject": ["Islam", "Islamic lectures", "Shaykh Muhammad Zain", series_title],
                "creator": "Shaykh Muhammad Zain",
                "language": "ara",
                "licenseurl": "https://creativecommons.org/licenses/by-nc/4.0/",
                "mediatype": "audio",
                "collection": "opensource_audio",
            }

            # Upload the file
            safe_fn = fn.replace(" ", "_").replace("/", "_")
            result = upload(
                item_id,
                files={safe_fn: tmp_path},
                metadata=metadata,
                access_key=IA_ACCESS,
                secret_key=IA_SECRET,
                verbose=False,
                retries=3,
            )

            os.unlink(tmp_path)
            tmp_path = None

            # Direct CDN URL
            ia_url = f"https://archive.org/download/{item_id}/{safe_fn}"

            if save_ia_record(lesson_id, fn, ia_url, file_size, duration):
                downloaded += 1
                print(f"    ✓ {fn[:45]} → {ia_url[:60]}", flush=True)
            else:
                failed += 1

        except Exception as e:
            print(f"    ✗ {fn[:40]} Error: {e}", flush=True)
            failed += 1
            if tmp_path and os.path.exists(tmp_path):
                try: os.unlink(tmp_path)
                except: pass

    # Process in chunks of 10 (sequential — IA upload is slow)
    chunk_size = 10
    for i in range(0, len(msg_ids), chunk_size):
        chunk = msg_ids[i:i + chunk_size]
        try:
            messages = await client.get_messages(entity, ids=chunk)
        except Exception as e:
            print(f"  Error fetching: {e}", flush=True)
            await asyncio.sleep(10)
            continue

        for msg in messages:
            await upload_one(msg)
            await asyncio.sleep(1)

        total_done = downloaded + failed + skipped
        remaining = len(msg_ids) - total_done
        print(f"\n  ✓{downloaded} done | ✗{failed} failed | {remaining} remaining\n", flush=True)

        if test_mode:
            print("Test mode: stopping after first chunk", flush=True)
            break

    await client.disconnect()
    print(f"\nDONE: {downloaded} uploaded to archive.org, {failed} failed", flush=True)


def main():
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=2000)
    parser.add_argument("--test", action="store_true", help="Test with 10 files only")
    parser.add_argument("--session", choices=["1", "2"], default="2",
                        help="1=importer (GitHub Actions), 2=importer2 (local, default)")
    args = parser.parse_args()

    asyncio.run(upload_to_archive(args.limit, test_mode=args.test, session_num=args.session))


if __name__ == "__main__":
    main()
