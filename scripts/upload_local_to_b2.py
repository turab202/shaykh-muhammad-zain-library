"""Upload locally stored audio files to B2 and link to lessons."""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config

STORAGE_BASE = Path(__file__).parent.parent / "storage"
BUCKET   = os.environ["B2_BUCKET_NAME"]
ENDPOINT = os.environ["B2_ENDPOINT"]
REGION   = ENDPOINT.split(".")[1]

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{ENDPOINT}",
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name=REGION,
    config=Config(signature_version="s3v4"),
)

# Use single-part upload for files under 100MB to avoid multipart timeout issues
transfer_config = TransferConfig(
    multipart_threshold=100 * 1024 * 1024,  # 100MB — use single PUT below that
    max_concurrency=1,
)

# Find all local audio files
local_files = (
    list((STORAGE_BASE / "audio").rglob("*.mp3")) +
    list((STORAGE_BASE / "audio").rglob("*.m4a")) +
    list((STORAGE_BASE / "audio").rglob("*.aac"))
)
print(f"Local audio files: {len(local_files)}")

# Check what's already in B2
r = s3.list_objects_v2(Bucket=BUCKET, Prefix="audio/")
in_b2 = {f["Key"] for f in r.get("Contents", [])}
print(f"Already in B2    : {len(in_b2)}\n")

uploaded = 0
skipped  = 0
failed   = 0

for local_path in local_files:
    rel    = local_path.relative_to(STORAGE_BASE)
    b2_key = str(rel).replace("\\", "/")  # e.g. audio/2026/filename.mp3

    if b2_key in in_b2:
        print(f"  skip (exists): {local_path.name[:55]}")
        skipped += 1
        continue

    size_kb = local_path.stat().st_size // 1024
    print(f"  Uploading: {local_path.name[:55]} ({size_kb:,} KB)")

    try:
        s3.upload_file(
            str(local_path), BUCKET, b2_key,
            ExtraArgs={"ContentType": "audio/mpeg", "CacheControl": "public, max-age=31536000"},
            Config=transfer_config,
        )
        print(f"  ✓ s3://{BUCKET}/{b2_key}")
        uploaded += 1
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        failed += 1

print(f"\nResult: uploaded={uploaded}, skipped={skipped}, failed={failed}")
if uploaded > 0:
    print("Now run: py scripts/link_b2_audio.py")
