# -*- coding: utf-8 -*-
"""Force link ALL unlinked B2 audio files to their lessons using exact filename matching."""
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

# List ALL audio files in B2 (paginate through all results)
b2_files = {}
paginator = s3.get_paginator("list_objects_v2")
for page in paginator.paginate(Bucket=BUCKET, Prefix="audio/"):
    for obj in page.get("Contents", []):
        if obj["Key"].lower().endswith(".mp3"):
            b2_files[obj["Key"]] = obj["Size"]
print(f"Total B2 audio: {len(b2_files)}")

conn = connect()
cur  = conn.cursor()

# Get all existing media storage keys
cur.execute('SELECT "storageKey" FROM media WHERE "mediaType"=\'AUDIO\'')
already_linked = {r[0] for r in cur.fetchall()}

# Get ALL telegram messages with their lessons
cur.execute("""
    SELECT ts."audioFilename", ts."messageId", l.id, l."lessonNumber"
    FROM telegram_messages ts
    LEFT JOIN lessons l ON l."telegramSourceId" = ts.id AND l.status = 'PUBLISHED'
    WHERE ts."audioFilename" IS NOT NULL
      AND ts."audioFilename" ILIKE '%%.mp3'
""")
tm_rows = cur.fetchall()

# Build lookup: clean_stem → (audioFilename, messageId, lessonId, lessonNum)
tm_lookup = {}
for fname, msg_id, lesson_id, lesson_num in tm_rows:
    if not fname:
        continue
    # Store by full stem (with spaces replaced by underscores)
    stem_clean = Path(fname).stem.replace(' ', '_')
    tm_lookup[stem_clean] = (fname, msg_id, lesson_id, lesson_num)
    # Also store original stem
    tm_lookup[Path(fname).stem] = (fname, msg_id, lesson_id, lesson_num)

created = 0
skipped = 0
no_match = 0

for b2_key, size in b2_files.items():
    storage_key = f"s3://{BUCKET}/{b2_key}"
    if storage_key in already_linked:
        skipped += 1
        continue

    b2_name = Path(b2_key).name
    # Strip hash suffix: xxx_8hex.mp3 → xxx.mp3
    b2_stem = Path(b2_name).stem
    clean_stem = re.sub(r'_[0-9a-f]{8}$', '', b2_stem)
    clean_stem_spaces = clean_stem.replace('_', ' ')

    # Try multiple matching strategies
    matched = (
        tm_lookup.get(b2_stem) or
        tm_lookup.get(clean_stem) or
        tm_lookup.get(clean_stem_spaces) or
        tm_lookup.get(b2_stem.replace('_', ' ')) or
        None
    )

    if not matched:
        # Try matching by the filename without the hash, with loose comparison
        for stem_key, row in tm_lookup.items():
            # Normalize both for comparison
            norm_b2  = re.sub(r'\s+', ' ', clean_stem.replace('_', ' ')).strip().lower()
            norm_tm  = re.sub(r'\s+', ' ', stem_key.replace('_', ' ')).strip().lower()
            if norm_b2 == norm_tm:
                matched = row
                break

    if not matched:
        no_match += 1
        continue

    fname, msg_id, lesson_id, lesson_num = matched

    if not lesson_id:
        no_match += 1
        continue

    # Create media record
    media_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
    try:
        cur.execute("""
            INSERT INTO media (id, filename, "mimeType", size, "mediaType",
                               "storageKey", "storageProvider", "lessonId", "createdAt")
            VALUES (%s,%s,'audio/mpeg',%s,'AUDIO'::"MediaType",%s,'S3'::"StorageProvider",%s,NOW())
            ON CONFLICT DO NOTHING
        """, (media_id, fname, size, storage_key, lesson_id))
        conn.commit()
        created += 1
        already_linked.add(storage_key)
        print(f"  ✓ #{lesson_num:>3} {fname[:45]}")
    except Exception as e:
        print(f"  ✗ Error: {e}")
        try: conn.rollback()
        except: pass

cur.close()
conn.close()
print(f"\nCreated={created} Skipped={skipped} No-match={no_match}")
print("Run py scripts/audio_status.py to verify")
