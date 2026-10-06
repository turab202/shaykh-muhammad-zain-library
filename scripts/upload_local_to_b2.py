"""Upload locally downloaded audio files to B2 and update Neon DB."""
import sys, os, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import boto3
from _neon import connect

STORAGE_BASE = Path(__file__).parent.parent / "storage"

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{os.environ['B2_ENDPOINT']}",
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name="auto",
)
BUCKET = os.environ["B2_BUCKET_NAME"]

# Find all local audio files
local_files = list(STORAGE_BASE.rglob("*.mp3")) + list(STORAGE_BASE.rglob("*.pdf"))
print(f"Local files to upload: {len(local_files)}")

if not local_files:
    print("No local files found.")
    raise SystemExit(0)

conn = connect()
cur = conn.cursor()

uploaded = 0
for local_path in local_files:
    # Derive storage key from relative path
    rel = local_path.relative_to(STORAGE_BASE)
    b2_key = str(rel).replace("\\", "/")
    b2_url = f"s3://{BUCKET}/{b2_key}"

    print(f"\nUploading: {local_path.name[:60]}")
    print(f"  → B2 key: {b2_key}")

    # Upload to B2
    mime = "audio/mpeg" if local_path.suffix.lower() == ".mp3" else "application/pdf"
    try:
        with open(local_path, "rb") as f:
            s3.put_object(Bucket=BUCKET, Key=b2_key, Body=f,
                         ContentType=mime, CacheControl="public, max-age=31536000")
        print(f"  ✓ Uploaded ({local_path.stat().st_size // 1024} KB)")
    except Exception as e:
        print(f"  ✗ Upload failed: {e}")
        continue

    # Find the TelegramMessage with this audio filename
    filename_original = local_path.stem  # without hash suffix
    # The filename in DB has the original Arabic name before hashing
    # Try to match by the content of the file against audioFilename in DB
    cur.execute("""
        SELECT id, "messageId", "audioFilename", "suggestedMetadata"
        FROM telegram_messages
        WHERE "chatId" = '1747155048'
          AND "processedAt" IS NOT NULL
          AND (
            "suggestedMetadata"->>'mediaStorageKey' IS NULL
            OR "suggestedMetadata"->>'mediaStorageKey' NOT LIKE 's3://%'
          )
        ORDER BY "messageId" DESC
        LIMIT 1
    """)
    row = cur.fetchone()
    if not row:
        # Try unprocessed messages
        cur.execute("""
            SELECT id, "messageId", "audioFilename", "suggestedMetadata"
            FROM telegram_messages
            WHERE "chatId" = '1747155048'
              AND "audioFilename" IS NOT NULL
              AND "processedAt" IS NULL
            ORDER BY "messageId" DESC LIMIT 1
        """)
        row = cur.fetchone()

    if row:
        tm_id, msg_id, audio_fn, meta = row
        meta_dict = meta if isinstance(meta, dict) else json.loads(meta or "{}")
        meta_dict["mediaStorageKey"] = b2_url
        meta_dict["mediaFilename"] = audio_fn

        cur.execute(
            "UPDATE telegram_messages SET \"suggestedMetadata\"=%s WHERE id=%s",
            (json.dumps(meta_dict), tm_id)
        )

        # Update corresponding lesson's media record
        cur.execute(
            "SELECT id FROM media WHERE \"lessonId\" IN "
            "(SELECT id FROM lessons WHERE \"telegramSourceId\"=%s) LIMIT 1",
            (tm_id,)
        )
        media_row = cur.fetchone()
        if media_row:
            cur.execute(
                "UPDATE media SET \"storageKey\"=%s WHERE id=%s",
                (b2_url, media_row[0])
            )
            print(f"  ✓ Linked to lesson (msgId={msg_id})")
        else:
            print(f"  ℹ No media record found for msgId={msg_id}")

        conn.commit()
        uploaded += 1

print(f"\n✓ Done! Uploaded {uploaded}/{len(local_files)} files to B2.")
print("Audio will now stream from B2 on the live site.")
conn.close()
