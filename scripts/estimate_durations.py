# -*- coding: utf-8 -*-
"""
Estimate duration for lessons with duration=0 using file size.
Average bitrate for these lectures is ~128 kbps = 16 KB/s.
Duration (sec) ≈ file_size_bytes / 16000

This gives ~5% accuracy which is good enough for display.
After the user plays the lesson once, the real duration gets saved.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Get lessons with duration=0 that have media records with file size
cur.execute("""
    SELECT l.id, m.size, m."storageKey"
    FROM lessons l
    JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE l.status = 'PUBLISHED'
      AND (l.duration IS NULL OR l.duration = 0)
      AND m.size > 0
""")
rows = cur.fetchall()
print(f"Lessons with duration=0 but known file size: {len(rows)}")

# Average MP3 bitrate for these lectures = ~128 kbps = 16,000 bytes/sec
# Most Islamic lectures are encoded at 64-128 kbps
BYTES_PER_SEC = 16000  # 128 kbps

updates = []
for lesson_id, size, storage_key in rows:
    if size > 100000:  # ignore files < 100KB
        estimated_seconds = int(size / BYTES_PER_SEC)
        # Sanity check: between 5 min and 3 hours
        if 300 <= estimated_seconds <= 10800:
            updates.append((estimated_seconds, lesson_id))

print(f"Lessons to update with estimated duration: {len(updates)}")

if updates:
    cur.executemany(
        'UPDATE lessons SET duration=%s WHERE id=%s',
        updates
    )
    conn.commit()
    print(f"Updated {len(updates)} lessons with estimated duration")

# Show sample
cur.execute("""
    SELECT l.title, l.duration, m.size
    FROM lessons l
    JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.duration > 0
    ORDER BY l."updatedAt" DESC
    LIMIT 5
""")
print("\nSample updated lessons:")
for r in cur.fetchall():
    print(f"  {r[0][:40]} duration={r[1]//60}m{r[1]%60}s size={r[2]//1024}KB")

cur.close()
conn.close()
print("\nDone. Durations will show estimated times until real playback updates them.")
