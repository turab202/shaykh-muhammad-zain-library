"""
Download Tafsir as-Sa'di PDF volumes from the secondary Telegram channel
@SheikhMuhammedZainAdam and upload to B2.

The PDFs are at:
  https://t.me/SheikhMuhammedZainAdam/9840  (vol reference in lesson captions)

We need to find the actual PDF file message IDs.
"""
import asyncio, os, sys, time, secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config
from _neon import connect

BUCKET   = os.environ["B2_BUCKET_NAME"]
ENDPOINT = os.environ["B2_ENDPOINT"]
REGION   = ENDPOINT.split(".")[1]

s3 = boto3.client("s3",
    endpoint_url=f"https://{ENDPOINT}",
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name=REGION, config=Config(signature_version="s3v4"))

transfer_cfg = TransferConfig(multipart_threshold=100*1024*1024, max_concurrency=1)

async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    api_id   = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    phone    = os.environ["TELEGRAM_PHONE"]

    session_path = str(ROOT / "telegram" / ".session" / "importer")

    client = TelegramClient(session_path, api_id, api_hash,
        connection=ConnectionTcpObfuscated, timeout=60, use_ipv6=False)

    async def _code():
        return input("Telegram code: ").strip()

    for attempt in range(2):
        try:
            await client.start(phone=phone, code_callback=_code)
            break
        except Exception as e:
            if attempt == 0 and "AuthKey" in str(e):
                sf = Path(session_path + ".session")
                if sf.exists(): sf.unlink()
                client = TelegramClient(session_path, api_id, api_hash,
                    connection=ConnectionTcpObfuscated, timeout=60)
                continue
            print(f"Failed: {e}"); return

    me = await client.get_me()
    print(f"Connected as: {getattr(me, 'first_name', '?')}")

    # Try the secondary channel
    secondary_channel = "SheikhMuhammedZainAdam"
    try:
        entity = await client.get_entity(secondary_channel)
        print(f"Found channel: {entity.title} (id={entity.id})")
    except Exception as e:
        print(f"Could not access {secondary_channel}: {e}")
        print("Trying with t.me link...")
        try:
            entity = await client.get_entity("https://t.me/SheikhMuhammedZainAdam")
            print(f"Found: {entity.title}")
        except Exception as e2:
            print(f"Failed: {e2}")
            await client.disconnect()
            return

    # Search for PDF files — wider search, all PDFs in channel
    print("\nSearching for ALL PDFs in channel (last 500 messages)...")
    tmp_dir = ROOT / "storage" / "pdfs"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    pdf_count = 0
    async for message in client.iter_messages(entity, limit=500):
        if not message.document:
            continue
        filename = None
        for attr in message.document.attributes:
            if hasattr(attr, 'file_name') and attr.file_name:
                filename = attr.file_name
                break
        if not filename or not filename.lower().endswith('.pdf'):
            continue

        size_mb = message.document.size // (1024*1024)
        print(f"  PDF: {filename[:60]} ({size_mb}MB) msgId={message.id}")

        save_path = tmp_dir / filename
        if save_path.exists():
            print(f"  Already downloaded locally")
        else:
            print(f"  Downloading...")
            await client.download_media(message, file=str(save_path))
            print(f"  Downloaded: {save_path.stat().st_size//1024}KB")

        # Upload to B2
        b2_key = f"pdfs/{filename}"
        # Check if already in B2
        try:
            s3.head_object(Bucket=BUCKET, Key=b2_key)
            print(f"  Already in B2")
        except Exception:
            print(f"  Uploading to B2...")
            s3.upload_file(str(save_path), BUCKET, b2_key,
                ExtraArgs={"ContentType": "application/pdf"},
                Config=transfer_cfg)
            print(f"  Uploaded: s3://{BUCKET}/{b2_key}")

        # Link to DB
        storage_key = f"s3://{BUCKET}/{b2_key}"
        conn = connect()
        cur = conn.cursor()
        cur.execute("SELECT id FROM books WHERE slug='tafsir-al-saadi'")
        book_row = cur.fetchone()
        if book_row:
            book_id = book_row[0]
            media_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
            cur.execute("""
                INSERT INTO media (id, filename, "mimeType", size, "mediaType",
                    "storageKey", "storageProvider", "bookId", "createdAt")
                VALUES (%s, %s, 'application/pdf', %s, 'PDF'::"MediaType",
                    %s, 'S3'::"StorageProvider", %s, NOW())
                ON CONFLICT DO NOTHING
            """, (media_id, filename, save_path.stat().st_size,
                  storage_key, book_id))
            conn.commit()
            print(f"  Linked to tafsir-al-saadi book!")
        cur.close()
        conn.close()

        pdf_count += 1
        # Clean up local after successful upload
        save_path.unlink(missing_ok=True)

    if pdf_count == 0:
        print("\nNo Tafsir as-Sa'di PDFs found in that channel.")
        print("The PDF may be in a different location.")
        print("You can upload it manually via: /en/admin/books")

    await client.disconnect()
    print(f"\nDone. Found and processed {pdf_count} PDFs.")

if __name__ == "__main__":
    asyncio.run(main())
