"""Move misplaced audio files from pdfs/ to audio/ in B2, then re-link."""
import os, sys, boto3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")
from _neon import connect

BUCKET   = os.environ["B2_BUCKET_NAME"]
ENDPOINT = os.environ["B2_ENDPOINT"]
REGION   = ENDPOINT.split(".")[1]

s3 = boto3.client("s3", endpoint_url=f"https://{ENDPOINT}",
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name=REGION)

# List all files in pdfs/ that are actually audio (mp3/m4a/aac)
resp = s3.list_objects_v2(Bucket=BUCKET, Prefix="pdfs/")
files = resp.get("Contents", [])

audio_exts = {".mp3", ".m4a", ".aac", ".ogg", ".wav"}
to_move = [f for f in files if Path(f["Key"]).suffix.lower() in audio_exts]

print(f"Found {len(to_move)} audio files misplaced in pdfs/:")
for f in to_move:
    print(f"  {f['Key']} ({f['Size']:,} bytes)")

conn = connect()
cur = conn.cursor()

for f in to_move:
    old_key = f["Key"]
    filename = Path(old_key).name
    new_key = f"audio/2026/{filename}"
    new_storage_key = f"s3://{BUCKET}/{new_key}"
    old_storage_key = f"s3://{BUCKET}/{old_key}"

    print(f"\nMoving: {old_key} → {new_key}")

    # Copy to new location
    s3.copy_object(Bucket=BUCKET,
        CopySource={"Bucket": BUCKET, "Key": old_key},
        Key=new_key)

    # Delete old location
    s3.delete_object(Bucket=BUCKET, Key=old_key)
    print(f"  ✓ Moved in B2")

    # Update any media records pointing to old key
    cur.execute("UPDATE media SET \"storageKey\"=%s WHERE \"storageKey\"=%s",
                (new_storage_key, old_storage_key))
    rows = cur.rowcount
    print(f"  Updated {rows} media record(s)")

conn.commit()
cur.close()
conn.close()
print("\nDone.")
