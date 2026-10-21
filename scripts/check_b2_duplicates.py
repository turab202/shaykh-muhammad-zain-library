"""Check B2 for files that are NOT linked to any lesson (can be deleted safely)."""
import os, sys
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

# All B2 keys
b2_keys = {}
paginator = s3.get_paginator("list_objects_v2")
for page in paginator.paginate(Bucket=BUCKET):
    for obj in page.get("Contents", []):
        b2_keys[obj["Key"]] = obj["Size"]

print(f"Total B2 objects: {len(b2_keys)}")
print(f"Total size: {sum(b2_keys.values())/1024/1024:.0f} MB")

# Get all storage keys used in DB
conn = connect(); cur = conn.cursor()
cur.execute("SELECT \"storageKey\" FROM media WHERE \"mediaType\"='AUDIO'")
used_keys = set()
for r in cur.fetchall():
    sk = r[0]
    if sk and sk.startswith("s3://"):
        # convert s3://bucket/key to just key
        key = sk.split("/", 3)[-1]
        used_keys.add(key)

print(f"DB audio keys: {len(used_keys)}")

# Find B2 files NOT in DB
unused = {k: v for k, v in b2_keys.items() if k not in used_keys and k.startswith("audio/")}
unused_size = sum(unused.values())

print(f"\nUnused audio files in B2 (not linked to any lesson): {len(unused)}")
print(f"Space that can be freed: {unused_size/1024/1024:.0f} MB")

# Also check for PDF files
pdfs = {k: v for k, v in b2_keys.items() if k.startswith("pdfs/")}
print(f"\nPDF files in B2: {len(pdfs)} ({sum(pdfs.values())/1024/1024:.0f} MB)")

# Check for any test/temp files
others = {k: v for k, v in b2_keys.items() 
          if not k.startswith("audio/") and not k.startswith("pdfs/")}
print(f"Other files in B2: {len(others)} ({sum(others.values())/1024/1024:.0f} MB)")
for k, v in list(others.items())[:10]:
    print(f"  {k} ({v//1024} KB)")

cur.close(); conn.close()
