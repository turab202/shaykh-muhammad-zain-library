"""Check B2 bucket usage."""
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
    region_name=REGION,
    config=Config(signature_version="s3v4"))

total_size = 0
total_files = 0
paginator = s3.get_paginator("list_objects_v2")
for page in paginator.paginate(Bucket=BUCKET):
    for obj in page.get("Contents", []):
        total_size += obj["Size"]
        total_files += 1

print(f"Total files: {total_files}")
print(f"Total size:  {total_size / 1024 / 1024 / 1024:.2f} GB")
print(f"             {total_size / 1024 / 1024:.0f} MB")
print()
print("B2 free tier: 10 GB")
print(f"Used: {total_size / 1024 / 1024 / 1024:.2f} / 10 GB")
