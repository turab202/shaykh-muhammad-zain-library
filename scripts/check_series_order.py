"""Check how lessons are ordered in the Tafsir series to understand the sorting issue."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Show the first 20 lessons as they appear with publishedAt sort
cur.execute("""
    SELECT l."lessonNumber", l."publishedAt"::date as d, l.slug
    FROM lessons l JOIN series s ON l."seriesId"=s.id
    WHERE s.slug='tafsir-al-saadi' AND l.status='PUBLISHED'
    ORDER BY l."publishedAt" ASC, l."lessonNumber" ASC
    LIMIT 30
""")
rows = cur.fetchall()
print("First 30 lessons ordered by publishedAt, lessonNumber:")
for i, r in enumerate(rows):
    print(f"  {i+1:>3}. #{r[0]:>3}  {r[1]}  {r[2][:35]}")

print()
# Count how many distinct "runs" there are (identified by date gaps)
cur.execute("""
    SELECT DISTINCT l."publishedAt"::date as start_date,
           MIN(l."lessonNumber") as min_lesson,
           MAX(l."lessonNumber") as max_lesson,
           COUNT(*) as count
    FROM lessons l JOIN series s ON l."seriesId"=s.id
    WHERE s.slug='tafsir-al-saadi' AND l.status='PUBLISHED'
      AND l."lessonNumber" <= 5
    GROUP BY l."publishedAt"::date
    ORDER BY start_date
""")
print("Dates where lesson 1-5 appear (= start of each 'run'):")
for r in cur.fetchall():
    print(f"  {r[0]}  lessons #{r[1]}-{r[2]}  ({r[3]} lessons)")

conn.close()
