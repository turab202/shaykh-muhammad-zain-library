"""
Download PDF books from Telegram, upload to B2, and link to Book records.

Usage:
    py scripts/import_pdfs.py

Requires: same .env as main importer (TELEGRAM_*, B2_*, DATABASE_URL).
"""
import asyncio, os, sys, json, time, secrets, boto3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from _neon import connect

# ── Book slug mapping: substring of PDF filename → book slug ─────────────────
PDF_TO_BOOK: dict[str, str] = {
    # Tafsir as-Sa'di
    "تيسير_الكريم_الرحمن":  "tafsir-al-saadi",
    "تيسير الكريم":          "tafsir-al-saadi",
    "Quraan17394":           "tafsir-al-saadi",
    "Quraan17395":           "tafsir-al-saadi",
    "Quraan17396":           "tafsir-al-saadi",
    # Bulugh al-Maram
    "بلوغ المرام":           "bulugh-al-maram",
    "بلوغ_المرام":           "bulugh-al-maram",
    "متن بلوغ":              "bulugh-al-maram",
    # Al-Ajrumiyyah
    "المقدمة الآجرومية":     "al-ajrumiyyah",
    "الآجرومية":             "al-ajrumiyyah",
    "آجرومية":               "al-ajrumiyyah",
    "الجرومية":              "al-ajrumiyyah",
    # Al-Aqeedah al-Wasitiyyah
    "العقيدة الواسطية":      "al-aqeedah-al-wasitiyyah",
    "الواسطية":              "al-aqeedah-al-wasitiyyah",
    "مذكرة على العقيدة":     "al-aqeedah-al-wasitiyyah",
    # Riyad as-Salihin
    "رياض الصالحين":         "riyad-as-salihin",
    "رياض_الصالحين":         "riyad-as-salihin",
    # Sunan al-Nasai
    "سنن النسائي":           "sunan-al-nasai",
    "سنن_النسائي":           "sunan-al-nasai",
    # Sunan Ibn Majah
    "سنن ابن ماجه":          "sunan-ibn-majah",
    "سنن_ابن_ماجه":          "sunan-ibn-majah",
    # Al-Qawl al-Mufid
    "القول المفيد":          "al-qawl-al-mufid",
    "كتاب التوحيد":          "al-qawl-al-mufid",
    # Mustalah al-Hadith
    "مصطلح الحديث":          "mustalah-al-hadith",
    "مصطلح_الحديث":          "mustalah-al-hadith",
    # Muqaddimah al-Tafsir
    "مقدمة التفسير":         "muqaddimah-al-tafsir",
    "أصول التفسير":          "muqaddimah-al-tafsir",
    "شرح_مقدمة_التفسير":     "muqaddimah-al-tafsir",
    "مقدمة_في_أصول_التفسير": "muqaddimah-al-tafsir",
    "أصول_في_التفسير":       "muqaddimah-al-tafsir",
    "القواعد_الحسان":        "muqaddimah-al-tafsir",
    # Wasaya Luqman (not in books yet but add mapping)
    "وصايا لقمان":           "wasaya-luqman",
    "وصايا_لقمان":           "wasaya-luqman",
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


def db_write(tm_id: str, msg_id: int, tg_filename: str, size: int,
             storage_key: str, book_id) -> bool:
    """Write media record to DB with fresh connection — retries on SSL drop."""
    for attempt in range(3):
        try:
            conn = connect(retries=3)
            cur  = conn.cursor()

            # Find book_id if not already known
            if book_id is None:
                book_slug = match_book_slug(tg_filename)
                if book_slug:
                    cur.execute("SELECT id FROM books WHERE slug=%s", (book_slug,))
                    row = cur.fetchone()
                    book_id = row[0] if row else None

            media_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
            cur.execute("""
                INSERT INTO media (id, filename, "mimeType", size, "mediaType",
                                   "storageKey", "storageProvider", "bookId", "createdAt")
                VALUES (%s, %s, 'application/pdf', %s,
                        'PDF'::"MediaType", %s,
                        'S3'::"StorageProvider", %s, NOW())
                ON CONFLICT DO NOTHING
            """, (media_id, tg_filename, size, storage_key, book_id))

            cur.execute(
                'UPDATE telegram_messages SET "processedAt"=NOW() WHERE id=%s',
                (tm_id,)
            )
            conn.commit()
            cur.close()
            conn.close()
            return True
        except Exception as e:
            print(f"    DB write attempt {attempt+1}/3 failed: {e}")
            time.sleep(2 ** attempt)
    return False


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

    # ── Get PDF messages that haven't been downloaded yet ────────────────────
    print("Checking DB for pending PDFs...")
    conn = connect()
    cur  = conn.cursor()
    cur.execute("""
        SELECT tm.id, tm."messageId", tm."audioFilename"
        FROM telegram_messages tm
        WHERE tm."chatId" = '1747155048'
          AND tm."audioFilename" ILIKE '%%.pdf'
          AND NOT EXISTS (
              SELECT 1 FROM media m
              WHERE m."storageKey" LIKE 's3://%%/pdfs/%%'
                AND m.filename = tm."audioFilename"
          )
        ORDER BY tm."messageId" DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    print(f"PDF messages to process: {len(rows)}")

    if not rows:
        print("All PDFs already downloaded!")
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
            print(f"Connection failed: {e}"); return

    me = await client.get_me()
    print(f"Connected as: {getattr(me, 'first_name', '?')}\n")

    entity     = await client.get_entity(channel)
    downloaded = 0
    errors     = 0

    for tm_id, msg_id, filename in rows:
        print(f"  msgId={msg_id}  file={str(filename)[:55]}")
        try:
            message = await client.get_messages(entity, ids=msg_id)
            if not message or not message.document:
                print(f"    ↷ No document found"); continue

            tg_filename = filename or f"doc_{msg_id}.pdf"
            if not tg_filename:
                for attr in message.document.attributes:
                    if hasattr(attr, "file_name") and attr.file_name:
                        tg_filename = attr.file_name
                        break

            save_path = tmp_dir / tg_filename
            print(f"    Downloading...")
            await client.download_media(message, file=str(save_path))

            if not save_path.exists():
                print(f"    ✗ Download failed"); errors += 1; continue

            size = save_path.stat().st_size
            print(f"    Downloaded {size//1024}KB — Uploading to B2...")

            storage_key = upload_to_b2(save_path, tg_filename)
            print(f"    ✓ B2: {storage_key}")

            book_slug = match_book_slug(tg_filename)
            if book_slug:
                print(f"    Book: {book_slug}")
            else:
                print(f"    ⚠ No book match — PDF stored but not linked to a book")

            # Write to DB with fresh connection (avoids cursor-closed errors)
            book_id = None
            ok = db_write(tm_id, msg_id, tg_filename, size, storage_key, book_id)
            if ok:
                print(f"    ✓ DB updated")
                downloaded += 1
            else:
                print(f"    ✗ DB write failed after retries — file IS uploaded to B2")
                errors += 1

            # Clean up local file
            save_path.unlink(missing_ok=True)

        except Exception as e:
            print(f"    ✗ Error: {e}")
            errors += 1

    await client.disconnect()

    print(f"\n{'='*50}")
    print(f"  Downloaded + uploaded : {downloaded}")
    print(f"  Errors                : {errors}")
    print(f"\nRun `py scripts/check_books_state.py` to verify.")


if __name__ == "__main__":
    asyncio.run(main())
