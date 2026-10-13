# -*- coding: utf-8 -*-
"""Find B2 audio files with no DB media record and show why they don't match."""
import sys, os, re
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

r = s3.list_objects_v2(Bucket=BUCKET, Prefix="audio/")
b2_files = {f["Key"]: f["Size"] for f in r.get("Contents", [])
            if f["Key"].lower().endswith(".mp3")}
print(f"Total B2 audio files: {len(b2_files)}")

conn = connect()
cur = conn.cursor()

# Get all existing media storage keys
cur.execute('SELECT "storageKey" FROM media WHERE "mediaType"=\'AUDIO\'')
linked = {r[0] for r in cur.fetchall()}

# Find unlinked
unlinked = [(k, v) for k, v in b2_files.items()
            if f"s3://{BUCKET}/{k}" not in linked]
print(f"Unlinked: {len(unlinked)}")
print()

# Get all TM audioFilenames for matching
cur.execute("""
    SELECT ts."audioFilename", ts."messageId", l.id as lesson_id, l."lessonNumber"
    FROM telegram_messages ts
    LEFT JOIN lessons l ON l."telegramSourceId" = ts.id AND l.status = 'PUBLISHED'
    WHERE ts."audioFilename" IS NOT NULL
""")
tm_rows = cur.fetchall()
tm_by_stem = {}
for row in tm_rows:
    fname, msg_id, lesson_id, lesson_num = row
    if fname:
        stem = re.sub(r'_[0-9a-f]{8}$', '', Path(fname).stem)
        tm_by_stem[stem] = (fname, msg_id, lesson_id, lesson_num)
        # Also store original stem
        tm_by_stem[Path(fname).stem] = (fname, msg_id, lesson_id, lesson_num)

for b2_key, size in unlinked:
    b2_stem = re.sub(r'_[0-9a-f]{8}$', '', Path(b2_key).stem)
    b2_original = Path(b2_key).stem

    matched = tm_by_stem.get(b2_stem) or tm_by_stem.get(b2_original)

    print(f"  B2: {Path(b2_key).name[:55]}")
    if matched:
        fname, msg_id, lesson_id, lesson_num = matched
        print(f"    MATCH: msg={msg_id} lesson_num={lesson_num} file={fname[:40]}")
        print(f"    → Can be linked!")
    else:
        # Try prefix match (lesson number)
        num_m = re.match(r'^(\d+)', b2_stem)
        if num_m:
            num = num_m.group(1).lstrip('0') or '0'
            candidates = [(s, r) for s, r in tm_by_stem.items()
                         if re.match(r'^0*' + num + r'[_\-\s]', s)]
            if candidates:
                print(f"    PARTIAL: num={num} → {candidates[0][1][0][:40]}")
            else:
                print(f"    NO MATCH (num={num})")
        else:
            print(f"    NO MATCH (no number prefix)")

cur.close()
conn.close()
