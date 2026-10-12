"""
Fix audio durations by reading actual MP3 metadata from B2 files.
Uses mutagen to read ID3 tags / MP3 headers for accurate duration.

Install: pip install mutagen boto3
"""
import sys, os, io, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import boto3
from botocore.config import Config

try:
    from mutagen.mp3 import MP3
    from mutagen import File as MutagenFile
except ImportError:
    print("Installing mutagen...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "mutagen"], check=True)
    from mutagen.mp3 import MP3
    from mutagen import File as MutagenFile

from _neon import connect

BUCKET   = os.environ["B2_BUCKET_NAME"]
ENDPOINT = os.environ["B2_ENDPOINT"]
REGION   = ENDPOINT.split(".")[1]

s3 = boto3.client("s3",
    endpoint_url=f"https://{ENDPOINT}",
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name=REGION, config=Config(signature_version="s3v4"))

def get_mp3_duration_from_bytes(data: bytes, filename: str) -> int | None:
    """Get duration in seconds from MP3 bytes using mutagen."""
    try:
        buf = io.BytesIO(data)
        buf.name = filename  # mutagen needs filename for format detection
        audio = MutagenFile(buf)
        if audio and hasattr(audio, 'info') and hasattr(audio.info, 'length'):
            return int(audio.info.length)
    except Exception as e:
        pass
    # Try MP3 specifically
    try:
        buf = io.BytesIO(data)
        audio = MP3(buf)
        if audio.info.length > 0:
            return int(audio.info.length)
    except Exception:
        pass
    return None

def get_mp3_duration_from_range(key: str, filename: str) -> int | None:
    """
    Download first 256KB of MP3 to get VBR header / CBR header,
    and last 4KB for Xing/VBRI frame. Enough for mutagen to calculate duration.
    """
    try:
        # Get file size first
        head = s3.head_object(Bucket=BUCKET, Key=key)
        total_size = head['ContentLength']

        # Download first 256KB (contains ID3 + XING/VBRI frame for VBR)
        first_chunk_size = min(262144, total_size)
        resp = s3.get_object(Bucket=BUCKET, Key=key,
                             Range=f"bytes=0-{first_chunk_size-1}")
        first_bytes = resp['Body'].read()

        dur = get_mp3_duration_from_bytes(first_bytes, filename)
        if dur and dur > 60:  # Sanity check: >1 minute
            return dur

        # If that failed, download full file (small files <5MB)
        if total_size < 5 * 1024 * 1024:
            resp = s3.get_object(Bucket=BUCKET, Key=key)
            all_bytes = resp['Body'].read()
            dur = get_mp3_duration_from_bytes(all_bytes, filename)
            if dur:
                return dur

    except Exception as e:
        print(f"    Error: {e}")
    return None

# Get all lessons with B2 audio
conn = connect()
cur = conn.cursor()

cur.execute("""
    SELECT l.id, l.slug, l.duration, l."lessonNumber",
           m."storageKey", m.size, m.filename
    FROM lessons l
    JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE l.status = 'PUBLISHED'
      AND m."storageKey" LIKE 's3://%%'
    ORDER BY l."seriesId", l."lessonNumber"
""")
rows = cur.fetchall()
print(f"Lessons with B2 audio: {len(rows)}")
print(f"Checking durations...\n")

updated = 0
skipped = 0
errors = 0

for lesson_id, slug, db_duration, lesson_num, storage_key, size, filename in rows:
    # Extract B2 key from s3://bucket/key
    b2_key = "/".join(storage_key.split("/")[3:])
    b2_filename = Path(b2_key).name

    # Estimate duration at various bitrates for sanity check
    size_mb = (size or 0) / (1024 * 1024)

    print(f"  #{lesson_num:>3} {slug[:35]:35s}  DB={db_duration//60 if db_duration else 0}m  size={size_mb:.1f}MB")

    # Get real duration from file
    real_duration = get_mp3_duration_from_range(b2_key, b2_filename)

    if real_duration and real_duration > 30:  # Must be >30 seconds to be valid
        if db_duration != real_duration:
            print(f"        DB: {db_duration//60 if db_duration else 0}:{(db_duration or 0)%60:02d}  →  Real: {real_duration//60}:{real_duration%60:02d}  ✓ UPDATING")
            cur.execute("UPDATE lessons SET duration=%s WHERE id=%s", (real_duration, lesson_id))
            # Also update media record
            cur.execute("UPDATE media SET duration=%s WHERE \"lessonId\"=%s AND \"mediaType\"='AUDIO'",
                       (real_duration, lesson_id))
            conn.commit()
            updated += 1
        else:
            print(f"        Already correct: {real_duration//60}:{real_duration%60:02d}")
            skipped += 1
    else:
        print(f"        Could not read duration (got {real_duration})")
        errors += 1

    # Small delay to avoid B2 rate limiting
    time.sleep(0.2)

cur.close()
conn.close()
print(f"\nUpdated: {updated}, Skipped: {skipped}, Errors: {errors}")
