"""Link lessons to their books where bookId is not set but series has a matching book."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Find series that have a book with the same slug but lessons without bookId
cur.execute("""
    SELECT s.id as series_id, s.slug as series_slug,
           b.id as book_id, b.slug as book_slug,
           COUNT(l.id) as unlinked_count
    FROM series s
    JOIN books b ON b.slug = s.slug
    LEFT JOIN lessons l ON l."seriesId" = s.id
                       AND l.status = 'PUBLISHED'
                       AND l."bookId" IS NULL
    WHERE s.status = 'PUBLISHED'
    GROUP BY s.id, s.slug, b.id, b.slug
    HAVING COUNT(l.id) > 0
    ORDER BY COUNT(l.id) DESC
""")
rows = cur.fetchall()
print(f"Series with unlinked lessons: {len(rows)}")
for r in rows:
    print(f"  {r[1]:35s} → {r[3]:35s} ({r[4]} lessons to link)")

total_updated = 0
for series_id, series_slug, book_id, book_slug, count in rows:
    cur.execute("""
        UPDATE lessons
        SET "bookId" = %s
        WHERE "seriesId" = %s
          AND status = 'PUBLISHED'
          AND "bookId" IS NULL
    """, (book_id, series_id))
    updated = cur.rowcount
    print(f"\n  ✓ Linked {updated} lessons in '{series_slug}' → book '{book_slug}'")
    total_updated += updated

conn.commit()
print(f"\nTotal lessons linked to books: {total_updated}")

# Final check
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND \"bookId\" IS NOT NULL")
with_book = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
total = cur.fetchone()[0]
print(f"Lessons with bookId: {with_book}/{total}")

cur.close()
conn.close()
