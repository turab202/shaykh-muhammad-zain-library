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
    region_name=REGION, config=Config(signature_version="s3v4"))

from _neon import connect
conn = connect(); cur = conn.cursor()

# Get average file sizes already in B2 per series
cur.execute("""
    SELECT s.slug, 
           AVG(m.size)/1024/1024 as avg_mb,
           COUNT(m.id) as count
    FROM media m
    JOIN lessons l ON l.id = m."lessonId"
    JOIN series s ON s.id = l."seriesId"
    WHERE m."mediaType" = 'AUDIO'
    GROUP BY s.slug
    ORDER BY avg_mb DESC
    LIMIT 15
""")
print("Average file size per series (already downloaded):")
for r in cur.fetchall():
    print(f"  {r[0]:42s} {r[1]:6.1f} MB avg  ({r[2]} files)")

# Total remaining data to download estimate
cur.execute("""
    SELECT COUNT(*) FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
      AND tm."audioFilename" IS NOT NULL
""")
remaining = cur.fetchone()[0]
print(f"\nRemaining lessons: {remaining}")
print(f"If avg 15MB: {remaining*15/1024:.1f} GB total to download")
print(f"If avg 30MB: {remaining*30/1024:.1f} GB total to download")

cur.close(); conn.close()
