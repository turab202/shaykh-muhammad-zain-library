"""Link uploaded B2 files to their lessons in Neon."""
import sys, os, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
import boto3
from _neon import connect

BUCKET = os.environ["B2_BUCKET_NAME"]
ENDPOINT = f"https://{os.environ['B2_ENDPOINT']}"

s3 = boto3.client("s3", endpoint_url=ENDPOINT,
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name="auto")

# List all files in B2
r = s3.list_objects_v2(Bucket=BUCKET)
b2_files = {f["Key"]: f["Size"] for f in r.get("Contents", [])}
print(f"Files in B2: {len(b2_files)}")
for k in b2_files: print(f"  {k}")

conn = connect()
cur = conn.cursor()

# For each B2 file, find the matching TelegramMessage by audioFilename
for b2_key, size in b2_files.items():
    # Extract original filename from key (remove hash suffix)
    filename = Path(b2_key).name  # e.g. 230_تفسير_السعدي_...mp3
    b2_url = f"s3://{BUCKET}/{b2_key}"

    # Match by audioFilename similarity (the hash changes the name slightly)
    # The original filename has the lesson number at the start
    lesson_num = filename.split("_")[0].strip() if "_" in filename else None

    cur.execute("""
        SELECT tm.id, tm."messageId", tm."audioFilename", l.id as lesson_id
        FROM telegram_messages tm
        LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
        WHERE tm."chatId" = '1747155048'
          AND tm."audioFilename" IS NOT NULL
          AND tm."audioFilename" ILIKE %s
        ORDER BY tm."messageId" DESC LIMIT 1
    """, (f"{lesson_num}%",))
    row = cur.fetchone()

    if row:
        tm_id, msg_id, audio_fn, lesson_id = row
        print(f"\nMatched: {audio_fn[:50]} → msgId={msg_id}, lessonId={lesson_id}")

        # Update or create media record
        if lesson_id:
            cur.execute("SELECT id FROM media WHERE \"lessonId\"=%s AND \"mediaType\"='AUDIO' LIMIT 1", (lesson_id,))
            media = cur.fetchone()
            if media:
                cur.execute("UPDATE media SET \"storageKey\"=%s WHERE id=%s", (b2_url, media[0]))
                print(f"  ✓ Updated media record")
            else:
                import secrets, time
                mid = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(12)}"[:25]
                cur.execute("""INSERT INTO media (id, filename, "mimeType", size, "mediaType", "storageKey",
                    "storageProvider", "lessonId", "createdAt")
                    VALUES (%s,%s,'audio/mpeg',%s,'AUDIO'::"MediaType",%s,'LOCAL'::"StorageProvider",%s,NOW())""",
                    (mid, audio_fn, size, b2_url, lesson_id))
                print(f"  ✓ Created media record")

            # Update lesson duration from file size estimate
            duration_est = int(size / (128 * 1024 / 8))  # rough 128kbps estimate
            cur.execute("UPDATE lessons SET duration=%s WHERE id=%s AND duration=0", (duration_est, lesson_id))

        # Update suggestedMetadata
        cur.execute("SELECT \"suggestedMetadata\" FROM telegram_messages WHERE id=%s", (tm_id,))
        meta = cur.fetchone()[0] or {}
        if isinstance(meta, str): meta = json.loads(meta)
        meta["mediaStorageKey"] = b2_url
        cur.execute("UPDATE telegram_messages SET \"suggestedMetadata\"=%s WHERE id=%s",
                   (json.dumps(meta), tm_id))
        conn.commit()
        print(f"  ✓ B2 URL linked: {b2_url[:60]}")
    else:
        print(f"\nNo match found for file: {filename[:60]}")

conn.close()
print("\n✓ Done! Check the live site.")
