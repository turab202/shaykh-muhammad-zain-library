import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn=connect(); cur=conn.cursor()

# media: mediaType is the column (not type)
cur.execute("SELECT COUNT(*) FROM media WHERE \"mediaType\"='AUDIO'")
print(f"Audio media records: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(DISTINCT \"lessonId\") FROM media WHERE \"mediaType\"='AUDIO' AND \"lessonId\" IS NOT NULL")
print(f"Lessons with audio: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
print(f"Published lessons: {cur.fetchone()[0]}")

# Books
cur.execute("SELECT COUNT(*) FROM books")
print(f"\nBooks total: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM media WHERE \"mediaType\"='PDF'")
print(f"PDF media records: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM books WHERE \"coverImageKey\" IS NOT NULL")
print(f"Books with cover: {cur.fetchone()[0]}")

# Per-series audio
print("\nPer-series audio coverage:")
cur.execute("""
    SELECT s.slug,
           COUNT(DISTINCT m."lessonId") as has_audio,
           COUNT(l.id) as total
    FROM series s
    JOIN lessons l ON l."seriesId"=s.id AND l.status='PUBLISHED'
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    GROUP BY s.slug
    ORDER BY (COUNT(l.id) - COUNT(DISTINCT m."lessonId")) DESC
    LIMIT 20
""")
for r in cur.fetchall():
    missing = r[2] - r[1]
    pct = r[1]*100//max(r[2],1)
    print(f"  {r[0]:42s} {r[1]:4d}/{r[2]:4d} ({pct:3d}%) missing={missing}")

cur.close(); conn.close()
