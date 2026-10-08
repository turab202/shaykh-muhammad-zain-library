"""
Fix B2 files that were uploaded with wrong Content-Type.
MP3 files uploaded as application/pdf need to be re-uploaded as audio/mpeg.
Uses S3 copy (server-side) to change metadata without re-uploading the bytes.
"""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import boto3
from botocore.config import Config

BUCKET   = os.environ["B2_BUCKET_NAME"]
ENDPOINT = os.environ["B2_ENDPOINT"]
REGION   = ENDPOINT.split(".")[1]

s3 = boto3.client("s3",
    endpoint_url=f"https://{ENDPOINT}",
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name=REGION,
    config=Config(signature_version="s3v4"))

# List all audio files in B2
r = s3.list_objects_v2(Bucket=BUCKET, Prefix="audio/")
files = r.get("Contents", [])
print(f"Audio files in B2: {len(files)}")

fixed = 0
for f in files:
    key = f["Key"]
    try:
        head = s3.head_object(Bucket=BUCKET, Key=key)
        content_type = head.get("ContentType", "")
        
        # Check if Content-Type is wrong for an MP3
        if key.lower().endswith(".mp3") and content_type != "audio/mpeg":
            print(f"\n  WRONG type: {key[:60]}")
            print(f"  Current: {content_type}  →  Fixing to: audio/mpeg")
            
            # B2 supports metadata update via copy-to-self
            s3.copy_object(
                Bucket=BUCKET,
                CopySource={"Bucket": BUCKET, "Key": key},
                Key=key,
                ContentType="audio/mpeg",
                MetadataDirective="REPLACE",
                CacheControl="public, max-age=31536000",
            )
            print(f"  ✓ Fixed")
            fixed += 1
        else:
            print(f"  OK ({content_type[:30]}): {key[:50]}")
    except Exception as e:
        print(f"  Error for {key[:50]}: {e}")

print(f"\nFixed {fixed} files.")
