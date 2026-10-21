# -*- coding: utf-8 -*-
"""
Free up B2 space by:
1. Deleting B2 audio files that have duplicate entries (same lesson, multiple files)
2. Deleting test/temp files
3. Deleting B2 files not linked to any lesson

Shows what will be deleted BEFORE deleting (dry-run first).
Run with --delete to actually delete.
"""
import sys, os, argparse
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
    region_name=REGION,
    config=Config(signature_version="s3v4"))

conn = connect()
cur = conn.cursor()

# Get all B2 audio files
b2_files = {}
paginator = s3.get_paginator("list_objects_v2")
for page in paginator.paginate(Bucket=BUCKET, Prefix="audio/"):
    for obj in page.get("Contents", []):
        b2_files[obj["Key"]] = obj["Size"]

print(f"Total B2 audio files: {len(b2_files)}")
print(f"Total size: {sum(b2_files.values())/1024/1024:.0f} MB")

# Get all storage keys actually used in DB (linked to lessons)
cur.execute("""
    SELECT "storageKey", "lessonId"
    FROM media
    WHERE "mediaType" = 'AUDIO'
      AND "storageKey" IS NOT NULL
""")
used = {}
for storage_key, lesson_id in cur.fetchall():
    if storage_key and storage_key.startswith("s3://"):
        b2_key = "/".join(storage_key.split("/")[3:])
        used[b2_key] = lesson_id

print(f"B2 files linked to lessons: {len(used)}")

# Find unlinked files
to_delete = []
for b2_key, size in b2_files.items():
    if b2_key not in used:
        to_delete.append((b2_key, size))

total_free = sum(s for _, s in to_delete)
print(f"\nFiles NOT linked to any lesson: {len(to_delete)}")
print(f"Space recoverable: {total_free/1024/1024:.0f} MB")
print()

for key, size in sorted(to_delete, key=lambda x: -x[1])[:20]:
    print(f"  {size//1024:6d} KB  {key[:70]}")

# Also find lessons with MULTIPLE audio files (duplicates)
cur.execute("""
    SELECT "lessonId", COUNT(*) as cnt,
           array_agg("storageKey" ORDER BY "createdAt") as keys
    FROM media
    WHERE "mediaType" = 'AUDIO'
    GROUP BY "lessonId"
    HAVING COUNT(*) > 1
""")
dupes = cur.fetchall()
print(f"\nLessons with duplicate audio files: {len(dupes)}")
dupe_keys_to_delete = []
for lesson_id, cnt, keys in dupes:
    # Keep the last (most recent), delete the others
    for k in keys[:-1]:  # all but last
        if k and k.startswith("s3://"):
            b2_key = "/".join(k.split("/")[3:])
            size = b2_files.get(b2_key, 0)
            dupe_keys_to_delete.append((b2_key, size))

dupe_size = sum(s for _, s in dupe_keys_to_delete)
print(f"Duplicate files to remove: {len(dupe_keys_to_delete)}")
print(f"Space from duplicates: {dupe_size/1024/1024:.0f} MB")

all_to_delete = to_delete + dupe_keys_to_delete
total_recoverable = sum(s for _, s in all_to_delete)
print(f"\nTOTAL recoverable: {total_recoverable/1024/1024:.0f} MB")
print(f"After cleanup: {(sum(b2_files.values()) - total_recoverable)/1024/1024:.0f} MB used")
print(f"Space freed for new uploads: {total_recoverable/1024/1024:.0f} MB")

parser = argparse.ArgumentParser()
parser.add_argument("--delete", action="store_true")
args = parser.parse_args()

if args.delete and all_to_delete:
    print(f"\nDeleting {len(all_to_delete)} files...")
    deleted = 0
    freed = 0
    for b2_key, size in all_to_delete:
        try:
            s3.delete_object(Bucket=BUCKET, Key=b2_key)
            deleted += 1
            freed += size
            if deleted % 10 == 0:
                print(f"  Deleted {deleted}...")
        except Exception as e:
            print(f"  Error deleting {b2_key}: {e}")

    # Also remove duplicate media records from DB
    for lesson_id, cnt, keys in dupes:
        for k in keys[:-1]:
            cur.execute("DELETE FROM media WHERE \"storageKey\"=%s", (k,))
    conn.commit()

    print(f"Deleted {deleted} files, freed {freed/1024/1024:.0f} MB")
elif not args.delete:
    print("\nRun with --delete to actually delete these files")

cur.close()
conn.close()
