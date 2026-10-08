"""Check how many lessons have bookId set."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND \"bookId\" IS NOT NULL")
with_book = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
total = cur.fetchone()[0]
print(f"Lessons with bookId: {with_book} / {total}")

# Check which series have books linked
cur.execute("""
    SELECT s.slug, s.title, b.slug as book_slug,
           COUNT(l.id) as lesson_count,
           COUNT(CASE WHEN l."bookId" IS NOT NULL THEN 1 END) as with_book
    FROM series s
    LEFT JOIN books b ON b.slug = s.slug OR s."bookId" = b.id
    LEFT JOIN lessons l ON l."seriesId" = s.id AND l.status = 'PUBLISHED'
    WHERE s.status = 'PUBLISHED'
    GROUP BY s.slug, s.title, b.slug
    ORDER BY lesson_count DESC
""")
rows = cur.fetchall()
print("\nSeries and their book links:")
for r in rows:
    print(f"  {r[0][:35]:35s} book={r[2] or 'NONE':25s} lessons={r[3]:3d} with_bookId={r[4]}")

cur.close()
conn.close()
