"""List files in B2 bucket and check what's stored in Neon."""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
import boto3

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{os.environ['B2_ENDPOINT']}",
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name="auto",
)

bucket = os.environ["B2_BUCKET_NAME"]
r = s3.list_objects_v2(Bucket=bucket)
files = r.get("Contents", [])
print(f"Files in B2 bucket '{bucket}': {len(files)}")
for f in files:
    print(f"  {f['Key']:<70} {f['Size']//1024:>7} KB")

# Also check local storage
storage = Path(__file__).parent.parent / "storage"
local = list(storage.rglob("*.mp3")) + list(storage.rglob("*.pdf"))
print(f"\nLocal storage files: {len(local)}")
for f in local:
    print(f"  {f.name[:70]}  {f.stat().st_size//1024:>7} KB")
