"""
Fix missing durations on lessons that have a media file in B2.
- Estimates duration from file size (128 kbps MP3 = 128*1024/8 = 16384 bytes/sec)
- Updates lessons where duration IS NULL and a B2 media record exists
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

BYTES_PER_SEC_128KBPS = 128 * 1024 // 8  # 16384 bytes/sec

# Most of these Arabic audio files are 32-64kbps compressed speech
# Use 32kbps as default estimate for undetermined files
# The real duration will be corrected when the audio element loads
BYTES_PER_SEC_32KBPS = 32 * 1024 // 8   # 4096 bytes/sec

conn = connect()
cur = conn.cursor()

# Find all lessons with NULL duration but with an audio media record
cur.execute("""
    SELECT l.id, l.slug, l.title, l.duration, m.size, m."storageKey"
    FROM lessons l
    JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE l.duration IS NULL
      AND m.size IS NOT NULL
      AND m.size > 0
""")
rows = cur.fetchall()
print(f"Found {len(rows)} lessons with NULL duration but known file size:")

updated = 0
for r in rows:
    lesson_id, slug, title, dur, size, key = r
    estimated = max(1, size // BYTES_PER_SEC_128KBPS)
    print(f"  {slug[:50]:50s}  size={size:,} bytes → ~{estimated}s ({estimated//60}m{estimated%60}s)")
    cur.execute("UPDATE lessons SET duration=%s WHERE id=%s", (estimated, lesson_id))
    updated += 1

conn.commit()
print(f"\nUpdated duration for {updated} lessons.")
conn.close()
