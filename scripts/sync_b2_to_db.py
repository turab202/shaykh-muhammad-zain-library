"""
Sync all audio files in B2 to DB media records.
Matches by audioFilename in telegram_messages, handles hash suffixes.
More aggressive matching than link_b2_audio.py.
"""
import sys, os, re, time, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
import boto3
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

# Get all audio files in B2
r = s3.list_objects_v2(Bucket=BUCKET, Prefix="audio/")
b2_files = {f["Key"]: f["Size"] for f in r.get("Contents", [])
            if f["Key"].lower().endswith(".mp3")}
print(f"Audio files in B2: {len(b2_files)}")

conn = connect()
cur  = conn.cursor()

# Get all telegram messages with audio filenames
cur.execute("""
    SELECT tm.id, tm."messageId", tm."audioFilename",
           l.id AS lesson_id, l."lessonNumber",
           m.id AS media_id, m."storageKey"
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id AND l.status = 'PUBLISHED'
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE tm."chatId" = '1747155048'
      AND tm."audioFilename" IS NOT NULL
      AND tm."audioFilename" ILIKE '%.mp3'
""")
rows = cur.fetchall()

# Build lookup: audioFilename stem → telegram message row
tm_by_stem = {}
for r in rows:
    tm_id, msg_id, filename, lesson_id, lesson_num, media_id, storage_key = r
    if filename:
        stem = Path(filename).stem  # without extension
        tm_by_stem[stem] = (tm_id, msg_id, filename, lesson_id, lesson_num, media_id, storage_key)

created = 0
updated = 0
no_match = 0

for b2_key, size in b2_files.items():
    b2_filename = Path(b2_key).name
    b2_stem     = Path(b2_filename).stem  # may have hash suffix

    # Try to find matching telegram message
    # B2 filename may be: "230_تفسير_...mp3" or "230_تفسير_..._59e4e406.mp3"
    # Strip hash suffix (last 8 hex chars before extension)
    clean_stem = re.sub(r'_[0-9a-f]{8}$', '', b2_stem)
    storage_key = f"s3://{BUCKET}/{b2_key}"

    matched = None
    # Try exact stem match
    if b2_stem in tm_by_stem:
        matched = tm_by_stem[b2_stem]
    elif clean_stem in tm_by_stem:
        matched = tm_by_stem[clean_stem]
    else:
        # Try matching by lesson number prefix
        num_m = re.match(r'^(\d+)', b2_stem)
        if num_m:
            num = num_m.group(1)
            for stem, row in tm_by_stem.items():
                if stem.startswith(num + '_') or stem.startswith(num + '-') or stem.startswith(num + ' '):
                    matched = row
                    break

    if not matched:
        no_match += 1
        continue

    tm_id, msg_id, filename, lesson_id, lesson_num, media_id, existing_key = matched

    # Already has this exact B2 key — skip
    if existing_key == storage_key:
        continue

    if media_id and existing_key and existing_key.startswith('s3://'):
        # Already has a different B2 key — skip (don't overwrite)
        continue

    if lesson_id is None:
        # No lesson linked to this telegram message — skip
        continue

    if media_id:
        # Update existing media record
        cur.execute('UPDATE media SET "storageKey"=%s WHERE id=%s', (storage_key, media_id))
        updated += 1
        print(f"  ✓ Updated #{lesson_num} {Path(b2_key).name[:40]}")
    else:
        # Create new media record
        new_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
        cur.execute("""
            INSERT INTO media (id, filename, "mimeType", size, "mediaType",
                               "storageKey", "storageProvider", "lessonId", "createdAt")
            VALUES (%s,%s,'audio/mpeg',%s,'AUDIO'::"MediaType",%s,'S3'::"StorageProvider",%s,NOW())
        """, (new_id, filename, size, storage_key, lesson_id))
        created += 1
        print(f"  ✓ Created #{lesson_num} {Path(b2_key).name[:40]}")

conn.commit()
cur.close()
conn.close()
print(f"\nCreated={created} Updated={updated} No-match={no_match}")

# Update durations
import subprocess, sys
subprocess.run([sys.executable, str(Path(__file__).parent / "fix_durations.py")])
