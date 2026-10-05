"""
Download PDF books from Telegram and store them.
Uses Telethon session (same as main importer).

Usage:
    py scripts/import_pdfs.py

This downloads all PDF files from the telegram_messages table
that haven't been stored yet, saves them to ./storage/pdfs/,
creates Media records, and links them to the appropriate Book.
"""
import asyncio
import os
import sys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import psycopg2
from telegram.importer.database import ImportDB, _cuid

# Book slug mapping from PDF filename patterns
PDF_TO_BOOK: dict[str, str] = {
    "تيسير_الكريم_الرحمن": "tafsir-al-saadi",
    "Quraan17394": "tafsir-al-saadi",
    "Quraan17395": "tafsir-al-saadi",
    "Quraan17396": "tafsir-al-saadi",
    "تيسير الكريم": "tafsir-al-saadi",
    "بلوغ المرام": "bulugh-al-maram",
    "متن بلوغ": "bulugh-al-maram",
    "بلوغ_المرام": "bulugh-al-maram",
    "المقدمة الآجرومية": "al-ajrumiyyah",
    "الآجرومية": "al-ajrumiyyah",
    "العقيدة الواسطية": "al-aqeedah-al-wasitiyyah",
    "الواسطية": "al-aqeedah-al-wasitiyyah",
    "مذكرة على العقيدة": "al-aqeedah-al-wasitiyyah",
    "رياض الصالحين": "riyad-as-salihin",
    "سنن النسائي": "sunan-al-nasai",
    "سنن ابن ماجه": "sunan-ibn-majah",
    "القول المفيد": "al-qawl-al-mufid",
    "كتاب التوحيد": "al-qawl-al-mufid",
    "الأصول الثلاثة": "al-usool-al-thalatha",
    "مصطلح الحديث": "mustalah-al-hadith",
    "شرح مقدمة التفسير": "muqaddimah-al-tafsir",
    "مقدمة في أصول التفسير": "muqaddimah-al-tafsir",
}

def match_book_slug(filename: str) -> str | None:
    fn = filename.lower()
    for pattern, slug in PDF_TO_BOOK.items():
        if pattern.lower() in fn or pattern.replace(" ", "_").lower() in fn:
            return slug
    return None


async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    api_id   = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    channel  = os.environ["TELEGRAM_CHANNEL"]

    session = str(ROOT / "telegram" / ".session" / "importer")
    db_url  = os.environ["DATABASE_URL"]
    storage_dir = ROOT / "storage" / "pdfs"
    storage_dir.mkdir(parents=True, exist_ok=True)

    # Get PDF messages not yet stored
    db_url_clean = db_url.split("?")[0] if "?" in db_url else db_url
    conn = psycopg2.connect(db_url_clean + "?channel_binding=disable" if "neon" in db_url_clean else db_url_clean)
    cur = conn.cursor()

    cur.execute("""
        SELECT tm.id, tm."messageId", tm."audioFilename", tm."suggestedMetadata"
        FROM telegram_messages tm
        WHERE tm."chatId" = '1747155048'
          AND tm."audioFilename" ILIKE '%.pdf'
          AND NOT EXISTS (
              SELECT 1 FROM media m WHERE m."storageKey" LIKE %s
          )
        ORDER BY tm."messageId" DESC
    """, ("%/pdfs/%",))
    rows = cur.fetchall()
    print(f"PDFs to download: {len(rows)}")

    if not rows:
        print("All PDFs already downloaded!")
        conn.close()
        return

    # Connect to Telegram
    DCS = [(2,"149.154.167.41",443),(1,"149.154.175.53",443),(5,"91.108.56.130",443),(4,"149.154.167.91",443)]
    client = None
    for dc_id, host, port in DCS:
        c = TelegramClient(session, api_id, api_hash, connection=ConnectionTcpObfuscated, timeout=30)
        c.session.set_dc(dc_id, host, port)
        try:
            await asyncio.wait_for(c.connect(), timeout=35)
            if await asyncio.wait_for(c.is_user_authorized(), timeout=20):
                print(f"Connected via DC{dc_id}")
                client = c
                break
        except Exception as e:
            print(f"DC{dc_id}: {e}")
            try: await c.disconnect()
            except: pass

    if not client:
        print("Could not connect to Telegram"); conn.close(); return

    entity = await client.get_entity(channel)

    downloaded = 0
    errors = 0

    for tm_id, msg_id, filename, meta in rows:
        try:
            print(f"  Downloading msgId={msg_id}  {str(filename)[:60]}...")
            message = await client.get_messages(entity, ids=msg_id)
            if not message or not message.document:
                print(f"    No document found"); continue

            save_path = storage_dir / (filename or f"doc_{msg_id}.pdf")
            await client.download_media(message, file=str(save_path))

            if not save_path.exists():
                print(f"    Download failed"); continue

            size = save_path.stat().st_size
            storage_key = f"pdfs/{save_path.name}"
            book_slug = match_book_slug(str(filename or ""))

            # Find book_id
            book_id = None
            if book_slug:
                cur.execute("SELECT id FROM books WHERE slug=%s", (book_slug,))
                row = cur.fetchone()
                book_id = row[0] if row else None

            # Create media record
            media_id = _cuid()
            cur.execute("""
                INSERT INTO media (id, filename, "mimeType", size, "mediaType", "storageKey", "storageProvider", "bookId", "createdAt")
                VALUES (%s,%s,'application/pdf',%s,'PDF'::"MediaType",%s,'LOCAL'::"StorageProvider",%s,NOW())
            """, (media_id, str(filename), size, storage_key, book_id))

            # Update suggestedMetadata
            meta_dict = meta if isinstance(meta, dict) else json.loads(meta or "{}")
            meta_dict["mediaStorageKey"] = storage_key
            meta_dict["pdfBookSlug"] = book_slug
            cur.execute(
                "UPDATE telegram_messages SET \"processedAt\"=NOW(), \"suggestedMetadata\"=%s WHERE id=%s",
                (json.dumps(meta_dict), tm_id)
            )
            conn.commit()

            print(f"    ✓ Saved {size//1024}KB → {storage_key}  book={book_slug or '?'}")
            downloaded += 1

        except Exception as e:
            print(f"    ✗ Error: {e}")
            errors += 1

    await client.disconnect()
    conn.close()

    print(f"\n{'='*50}")
    print(f"  Downloaded: {downloaded}")
    print(f"  Errors    : {errors}")
    print(f"\nPDFs stored in: {storage_dir}")
    print("Next: deploy to Vercel and serve PDFs via /api/media/pdfs/...")


if __name__ == "__main__":
    asyncio.run(main())
