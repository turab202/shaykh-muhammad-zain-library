"""
Configure CORS on the Backblaze B2 bucket to allow the Vercel app to load audio.
Also verify the bucket is accessible.

B2's S3-compatible API supports PutBucketCors.
"""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
import boto3
from botocore.exceptions import ClientError

BUCKET   = os.environ["B2_BUCKET_NAME"]
ENDPOINT = f"https://{os.environ['B2_ENDPOINT']}"
REGION   = os.environ['B2_ENDPOINT'].split(".")[1]  # "us-east-005"

s3 = boto3.client(
    "s3",
    endpoint_url=ENDPOINT,
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name=REGION,
)

# ── 1. Show current CORS ──────────────────────────────────
print("Current CORS config:")
try:
    resp = s3.get_bucket_cors(Bucket=BUCKET)
    for rule in resp.get("CORSRules", []):
        print(f"  {rule}")
except ClientError as e:
    print(f"  None / Error: {e.response['Error']['Message']}")

# ── 2. Set permissive CORS for audio streaming ────────────
print("\nSetting CORS rules...")
cors_config = {
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedOrigins": [
                # Production Vercel domain
                "https://shaykh-muhammad-zain-library.vercel.app",
                # Development
                "http://localhost:3000",
                "http://localhost:3001",
            ],
            "ExposeHeaders": ["Content-Length", "Content-Range", "Content-Type", "Accept-Ranges"],
            "MaxAgeSeconds": 3600,
        }
    ]
}

try:
    s3.put_bucket_cors(Bucket=BUCKET, CORSConfiguration=cors_config)
    print("  ✓ CORS rules set successfully!")
except ClientError as e:
    print(f"  ✗ Error setting CORS: {e}")

# ── 3. Verify the file exists ─────────────────────────────
print("\nVerifying audio file exists in B2:")
try:
    resp = s3.list_objects_v2(Bucket=BUCKET, Prefix="audio/")
    files = resp.get("Contents", [])
    print(f"  Found {len(files)} audio file(s):")
    for f in files:
        print(f"  {f['Key']}  ({f['Size']:,} bytes)")
except ClientError as e:
    print(f"  Error: {e}")

# ── 4. Generate a test pre-signed URL ─────────────────────
print("\nGenerating test pre-signed URL:")
try:
    from botocore.client import Config
    # Re-create client without path style for presigning (some B2 regions need it)
    s3_presign = boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
        aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
        region_name=REGION,
        config=Config(signature_version="s3v4"),
    )
    
    # Get the first file key
    resp = s3.list_objects_v2(Bucket=BUCKET, Prefix="audio/")
    files = resp.get("Contents", [])
    if files:
        key = files[0]["Key"]
        url = s3_presign.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": key},
            ExpiresIn=300,
        )
        print(f"  Key: {key}")
        print(f"  URL: {url[:100]}...")
        print()
        print("  → Paste this URL in your browser to test if B2 serves the audio")
    else:
        print("  No files found.")
except Exception as e:
    print(f"  Error: {e}")
