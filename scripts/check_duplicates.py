"""Find duplicate lesson numbers within the same series."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Find series that have multiple lessons with the same lesson number
cur.execute("""
    SELECT s.slug, s.title, l."lessonNumber",
           COUNT(*) as count,
           MIN(l."publishedAt") as earliest,
           MAX(l."publishedAt") as latest
    FROM lessons l
    JOIN series s ON l."seriesId" = s.id
    WHERE l.status = 'PUBLISHED'
      AND l."lessonNumber" IS NOT NULL
    GROUP BY s.slug, s.title, l."lessonNumber"
    HAVING COUNT(*) > 1
    ORDER BY s.slug, l."lessonNumber"
    LIMIT 30
""")
rows = cur.fetchall()
print(f"Duplicate lesson numbers: {len(rows)}")
for r in rows:
    print(f"  {r[0][:30]:30s} #{r[2]:>3}  x{r[3]}  ({str(r[4])[:10] if r[4] else '?'} to {str(r[5])[:10] if r[5] else '?'})")

print()
# Check Tafsir specifically
cur.execute("""
    SELECT l."lessonNumber", l.slug, l."publishedAt", l.description,
           ts."messageId", ts."audioFilename"
    FROM lessons l
    JOIN series s ON l."seriesId" = s.id
    LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    WHERE s.slug = 'tafsir-al-saadi'
      AND l."lessonNumber" = 1
      AND l.status = 'PUBLISHED'
    ORDER BY l."publishedAt"
""")
rows2 = cur.fetchall()
print(f"Tafsir lesson #1 duplicates: {len(rows2)}")
for r in rows2:
    print(f"  {r[1][:45]}  date={str(r[2])[:10]}  desc={str(r[3])[:40]}  tg={r[4]}")
    print(f"    file: {r[5]}")

conn.close()
