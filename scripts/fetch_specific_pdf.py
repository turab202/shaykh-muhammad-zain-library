"""
Fetch the specific Tafsir as-Sa'di PDF from the direct Telegram link.
The PDF is at: https://t.me/SheikhMuhammedZainAdam/9840
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

# Known PDF message IDs to try in the secondary channel
# From lesson captions: https://t.me/SheikhMuhammedZainAdam/9840
PDF_MESSAGE_IDS = [9840, 9841, 9842, 9843, 9838, 9839]

# Also try Quraan IDs (seen in our PDF_TO_BOOK mapping)
# Quraan17394, Quraan17395, Quraan17396 suggest message IDs around 17394-17396

async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    api_id   = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    phone    = os.environ["TELEGRAM_PHONE"]
    session_path = str(ROOT / "telegram" / ".session" / "importer")

    client = TelegramClient(session_path, api_id, api_hash,
        connection=ConnectionTcpObfuscated, timeout=120, use_ipv6=False)

    async def _code():
        return input("Telegram code: ").strip()

    await client.start(phone=phone, code_callback=_code)
    me = await client.get_me()
    print(f"Connected as: {getattr(me, 'first_name', '?')}")

    tmp_dir = ROOT / "storage" / "pdfs"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # Try the secondary channel with specific message IDs
    channels_to_try = [
        "SheikhMuhammedZainAdam",
        "SheikhMuhammedZain",
    ]

    for channel_name in channels_to_try:
        print(f"\nTrying channel: @{channel_name}")
        try:
            entity = await client.get_entity(channel_name)
            print(f"  Found: {getattr(entity, 'title', channel_name)}")
        except Exception as e:
            print(f"  Failed: {e}")
            continue

        # Try fetching specific message IDs
        for msg_id in PDF_MESSAGE_IDS:
            try:
                msg = await client.get_messages(entity, ids=msg_id)
                if not msg:
                    continue
                if not msg.document:
                    print(f"  msgId={msg_id}: no document")
                    continue

                filename = None
                size = msg.document.size
                for attr in msg.document.attributes:
                    if hasattr(attr, 'file_name') and attr.file_name:
                        filename = attr.file_name
                        break

                print(f"  msgId={msg_id}: {filename} ({size//1024//1024}MB)")

                if filename and filename.lower().endswith('.pdf'):
                    save_path = tmp_dir / filename
                    print(f"    Downloading...")
                    await client.download_media(msg, file=str(save_path))
                    if save_path.exists():
                        print(f"    Downloaded: {save_path.stat().st_size//1024}KB")
                        # Upload to B2
                        b2_key = f"pdfs/{filename}"
                        s3.upload_file(str(save_path), BUCKET, b2_key,
                            ExtraArgs={"ContentType": "application/pdf"},
                            Config=transfer_cfg)
                        storage_key = f"s3://{BUCKET}/{b2_key}"
                        print(f"    Uploaded to B2: {storage_key}")

                        # Link to DB
                        conn = connect()
                        cur = conn.cursor()
                        cur.execute("SELECT id FROM books WHERE slug='tafsir-al-saadi'")
                        book_row = cur.fetchone()
                        if book_row:
                            mid = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
                            cur.execute("""
                                INSERT INTO media (id, filename, "mimeType", size, "mediaType",
                                    "storageKey", "storageProvider", "bookId", "createdAt")
                                VALUES (%s,%s,'application/pdf',%s,'PDF'::"MediaType",
                                    %s,'S3'::"StorageProvider",%s,NOW())
                                ON CONFLICT DO NOTHING
                            """, (mid, filename, save_path.stat().st_size, storage_key, book_row[0]))
                            conn.commit()
                            print(f"    Linked to tafsir-al-saadi!")
                        cur.close()
                        conn.close()
                        save_path.unlink(missing_ok=True)

            except Exception as e:
                print(f"  msgId={msg_id}: error - {e}")

    await client.disconnect()
    print("\nDone.")

if __name__ == "__main__":
    asyncio.run(main())
