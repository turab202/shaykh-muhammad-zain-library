import os, sys
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
    region_name=REGION, config=Config(signature_version="s3v4"))

paginator = s3.get_paginator("list_objects_v2")
mp3_count = 0
for page in paginator.paginate(Bucket=BUCKET, Prefix="audio/"):
    for obj in page.get("Contents", []):
        if obj["Key"].lower().endswith(".mp3"):
            mp3_count += 1

print(f"Total MP3 files in B2: {mp3_count}")
