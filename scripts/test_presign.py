"""Test pre-signed URL generation for the Al-Qawl al-Mufid lesson 38 file."""
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

# The exact key from the DB
key = "audio/2026/038 -\u0627\u0644\u0642\u0648\u0644 \u0627\u0644\u0645\u0641\u064a\u062f \u0639\u0644\u0649 \u0643\u062a\u0627\u0628 \u0627\u0644\u062a\u0648\u062d\u064a\u062f .mp3"

print(f"Key: {key}")
print(f"Key bytes: {key.encode('utf-8').hex()[:40]}...")

# Test HEAD to verify file exists
try:
    head = s3.head_object(Bucket=BUCKET, Key=key)
    print(f"\nFile exists: YES")
    print(f"Size: {head['ContentLength']:,} bytes")
    print(f"Content-Type: {head['ContentType']}")
except Exception as e:
    print(f"\nFile exists: NO - {e}")

# Generate pre-signed URL
try:
    url = s3.generate_presigned_url("get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=300)
    print(f"\nPresigned URL: {url[:100]}...")
    print(f"URL length: {len(url)}")
except Exception as e:
    print(f"\nPresign failed: {e}")
