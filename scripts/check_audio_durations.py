"""Check duration accuracy for lessons that have B2 audio."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Get all lessons with B2 audio — check their duration vs file size
cur.execute("""
    SELECT l.slug, l.title, l.duration, l."lessonNumber",
           m."storageKey", m.size, m.duration AS media_duration,
           s.slug AS series_slug
    FROM lessons l
    JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    LEFT JOIN series s ON l."seriesId" = s.id
    WHERE l.status = 'PUBLISHED'
    ORDER BY l."lessonNumber"
""")
rows = cur.fetchall()
print(f"Lessons with B2 audio: {len(rows)}\n")

for r in rows:
    slug, title, dur, num, key, size, media_dur, series = r
    # Estimate duration at different bitrates
    est_128 = size // (128 * 1024 // 8) if size else 0
    est_64  = size // (64  * 1024 // 8) if size else 0

    def fmt(s):
        if not s: return "0:00"
        return f"{s//60}:{s%60:02d}"

    print(f"#{num:>3} {slug[:40]:40s}")
    print(f"     title   : {title[:60]}")
    print(f"     DB dur  : {fmt(dur)} ({dur}s)")
    print(f"     file sz : {size//1024:,}KB")
    print(f"     est@128k: {fmt(est_128)}")
    print(f"     est@64k : {fmt(est_64)}")
    print()

cur.close()
conn.close()
