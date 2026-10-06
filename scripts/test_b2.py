"""Test Backblaze B2 connection and upload a small test file."""
import sys, os, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import boto3
from botocore.exceptions import ClientError

KEY_ID  = os.environ["B2_APPLICATION_KEY_ID"]
APP_KEY = os.environ["B2_APPLICATION_KEY"]
BUCKET  = os.environ["B2_BUCKET_NAME"]
ENDPOINT = f"https://{os.environ['B2_ENDPOINT']}"

print(f"Connecting to {ENDPOINT} …")
s3 = boto3.client(
    "s3",
    endpoint_url=ENDPOINT,
    aws_access_key_id=KEY_ID,
    aws_secret_access_key=APP_KEY,
    region_name="auto",
)

# 1. List buckets
try:
    r = s3.list_buckets()
    print(f"✓ Connected! Buckets: {[b['Name'] for b in r.get('Buckets', [])]}")
except ClientError as e:
    print(f"✗ list_buckets failed: {e}")
    sys.exit(1)

# 2. Upload a small test file
test_key = "test/connection_test.txt"
print(f"\nUploading test file → {BUCKET}/{test_key} …")
try:
    s3.put_object(
        Bucket=BUCKET,
        Key=test_key,
        Body=b"Zain Library B2 test",
        ContentType="text/plain",
    )
    print("✓ Upload successful!")
except ClientError as e:
    print(f"✗ Upload failed: {e}")
    sys.exit(1)

# 3. Generate a pre-signed URL (for private bucket access)
url = s3.generate_presigned_url(
    "get_object",
    Params={"Bucket": BUCKET, "Key": test_key},
    ExpiresIn=3600,
)
print(f"\n✓ Pre-signed URL generated:")
print(f"  {url[:80]}...")

# 4. Clean up test file
s3.delete_object(Bucket=BUCKET, Key=test_key)
print("\n✓ Test file deleted. B2 is working correctly!")
print("\nReady to run the full import:")
print("  py -m telegram.importer.importer --live --limit 3500 --auto-publish")
