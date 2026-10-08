"""
Download PDF books from Telegram, upload to B2, and link to Book records.

Usage:
    py scripts/import_pdfs.py

Requires: same .env as main importer (TELEGRAM_*, B2_*, DATABASE_URL).
"""
import asyncio, os, sys, json, time, boto3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from _neon import connect

# ── Book slug mapping: substring of PDF filename → book slug ─────────────────
PDF_TO_BOOK: dict[str, str] = {
    "تيسير_الكريم_الرحمن":  "tafsir-al-saadi",
    "تيسير الكريم":          "tafsir-al-saadi",
    "Quraan17394":           "tafsir-al-saadi",
    "Quraan17395":           "tafsir-al-saadi",
    "Quraan17396":           "tafsir-al-saadi",
    "بلوغ المرام":           "bulugh-al-maram",
    "بلوغ_المرام":           "bulugh-al-maram",
    "متن بلوغ":              "bulugh-al-maram",
    "المقدمة الآجرومية":     "al-ajrumiyyah",
    "الآجرومية":             "al-ajrumiyyah",
    "آجرومية":               "al-ajrumiyyah",
    "العقيدة الواسطية":      "al-aqeedah-al-wasitiyyah",
    "الواسطية":              "al-aqeedah-al-wasitiyyah",
    "مذكرة على العقيدة":     "al-aqeedah-al-wasitiyyah",
    "رياض الصالحين":         "riyad-as-salihin",
    "سنن النسائي":           "sunan-al-nasai",
    "سنن ابن ماجه":          "sunan-ibn-majah",
    "القول المفيد":          "al-qawl-al-mufid",
    "كتاب التوحيد":          "al-qawl-al-mufid",
    "الأصول الثلاثة":        "al-usool-al-thalatha",
    "مصطلح الحديث":          "mustalah-al-hadith",
    "مقدمة التفسير":         "muqaddimah-al-tafsir",
    "أصول التفسير":          "muqaddimah-al-tafsir",
}

def match_book_slug(filename: str) -> str | None:
    for pattern, slug in PDF_TO_BOOK.items():
        if pattern in filename or pattern.replace(" ", "_") in filename:
            return slug
    return None


def get_b2_client():
    endpoint = os.environ["B2_ENDPOINT"]
    region   = endpoint.split(".")[1]
    from botocore.config import Config
    return boto3.client(
        "s3",
        endpoint_url=f"https://{endpoint}",
        aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
        aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
        region_name=region,
        config=Config(signature_version="s3v4"),
    )


def upload_to_b2(local_path: Path, filename: str) -> str:
    """Upload PDF to B2 and return storage key s3://bucket/key."""
    from boto3.s3.transfer import TransferConfig
    s3     = get_b2_client()
    bucket = os.environ["B2_BUCKET_NAME"]
    key    = f"pdfs/{filename}"
    config = TransferConfig(multipart_threshold=100*1024*1024, max_concurrency=1)
    s3.upload_file(str(local_path), bucket, key,
                   ExtraArgs={"ContentType": "application/pdf"},
                   Config=config)
    return f"s3://{bucket}/{key}"


async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    api_id   = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    phone    = os.environ["TELEGRAM_PHONE"]
    channel  = os.environ["TELEGRAM_CHANNEL"]

    session_path = str(ROOT / "telegram" / ".session" / "importer")
    Path(session_path).parent.mkdir(parents=True, exist_ok=True)

    tmp_dir = ROOT / "storage" / "pdfs"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # ── Get PDF messages from DB ─────────────────────────────────────────────
    conn = connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT tm.id, tm."messageId", tm."audioFilename"
        FROM telegram_messages tm
        WHERE tm."chatId" = '1747155048'
          AND tm."audioFilename" ILIKE '%%.pdf'
          AND NOT EXISTS (
              SELECT 1 FROM media m
              WHERE m."storageKey" LIKE 's3://%%/pdfs/%%'
          )
        ORDER BY tm."messageId" DESC
    """)
    rows = cur.fetchall()
    print(f"PDF messages to process: {len(rows)}")

    if not rows:
        print("No PDFs to download.")
        conn.close()
        return

    # ── Connect to Telegram ──────────────────────────────────────────────────
    print("\nConnecting to Telegram...")
    client = TelegramClient(
        session_path, api_id, api_hash,
        connection=ConnectionTcpObfuscated,
        connection_retries=5, timeout=60, use_ipv6=False,
    )

    async def _get_code():
        return input("Enter Telegram login code: ").strip()

    for attempt in range(2):
        try:
            await client.start(phone=phone, code_callback=_get_code)
            break
        except Exception as e:
            if attempt == 0 and "AuthKey" in str(e):
                sf = Path(session_path + ".session")
                if sf.exists(): sf.unlink()
                client = TelegramClient(session_path, api_id, api_hash,
                    connection=ConnectionTcpObfuscated, timeout=60, use_ipv6=False)
                continue
            print(f"Connection failed: {e}"); conn.close(); return

    me = await client.get_me()
    print(f"Connected as: {getattr(me, 'first_name', '?')}")

    entity = await client.get_entity(channel)

    downloaded = 0
    errors     = 0

    for tm_id, msg_id, filename in rows:
        try:
            print(f"\n  msgId={msg_id}  file={str(filename)[:50]}")
            message = await client.get_messages(entity, ids=msg_id)
            if not message or not message.document:
                print(f"    ↷ No document"); continue

            # Use filename from Telegram attributes if DB filename missing
            tg_filename = filename
            if not tg_filename:
                for attr in message.document.attributes:
                    if hasattr(attr, "file_name") and attr.file_name:
                        tg_filename = attr.file_name
                        break
            if not tg_filename:
                tg_filename = f"doc_{msg_id}.pdf"

            save_path = tmp_dir / tg_filename
            print(f"    Downloading {tg_filename}...")
            await client.download_media(message, file=str(save_path))

            if not save_path.exists():
                print(f"    ✗ Download failed"); errors += 1; continue

            size = save_path.stat().st_size
            print(f"    Downloaded {size//1024}KB")

            # Upload to B2
            print(f"    Uploading to B2...")
            storage_key = upload_to_b2(save_path, tg_filename)
            print(f"    ✓ B2: {storage_key}")

            # Match to book
            book_slug = match_book_slug(tg_filename)
            book_id   = None
            if book_slug:
                cur.execute("SELECT id FROM books WHERE slug=%s", (book_slug,))
                row = cur.fetchone()
                book_id = row[0] if row else None
                print(f"    Book: {book_slug} (id={str(book_id)[:12] if book_id else 'not found'})")
            else:
                print(f"    ⚠ No book match for: {tg_filename}")

            # Insert media record
            import secrets
            media_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
            cur.execute("""
                INSERT INTO media (id, filename, "mimeType", size, "mediaType",
                                   "storageKey", "storageProvider", "bookId", "createdAt")
                VALUES (%s, %s, 'application/pdf', %s,
                        'PDF'::"MediaType", %s,
                        'S3'::"StorageProvider", %s, NOW())
                ON CONFLICT DO NOTHING
            """, (media_id, tg_filename, size, storage_key, book_id))

            # Mark telegram_message as processed
            cur.execute(
                'UPDATE telegram_messages SET "processedAt"=NOW() WHERE id=%s',
                (tm_id,)
            )
            conn.commit()

            # Clean up local file
            save_path.unlink(missing_ok=True)
            downloaded += 1

        except Exception as e:
            print(f"    ✗ Error: {e}")
            errors += 1
            try: conn.rollback()
            except: pass

    await client.disconnect()
    cur.close()
    conn.close()

    print(f"\n{'='*50}")
    print(f"  Downloaded + uploaded: {downloaded}")
    print(f"  Errors               : {errors}")
    print(f"\nRun `py scripts/check_books_state.py` to verify.")


if __name__ == "__main__":
    asyncio.run(main())
