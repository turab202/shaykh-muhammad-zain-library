# -*- coding: utf-8 -*-
"""Hide books/series with no lessons and no PDFs (set to DRAFT)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Find published books with NO lessons AND NO PDFs
cur.execute("""
    SELECT b.id, b.slug, b.title,
           COUNT(DISTINCT l.id) as lesson_count,
           COUNT(DISTINCT m.id) as pdf_count
    FROM books b
    LEFT JOIN lessons l ON l."bookId" = b.id AND l.status = 'PUBLISHED'
    LEFT JOIN media m ON m."bookId" = b.id AND m."mediaType" = 'PDF'
    WHERE b.status = 'PUBLISHED'
    GROUP BY b.id, b.slug, b.title
    HAVING COUNT(DISTINCT l.id) = 0 AND COUNT(DISTINCT m.id) = 0
    ORDER BY b.slug
""")
empty_books = cur.fetchall()
print(f"Empty books (no lessons, no PDFs): {len(empty_books)}")
for r in empty_books:
    print(f"  {r[1]}: lessons={r[3]}, pdfs={r[4]}")

# Set them to DRAFT
if empty_books:
    ids = [r[0] for r in empty_books]
    cur.execute("UPDATE books SET status='DRAFT' WHERE id = ANY(%s)", (ids,))
    conn.commit()
    print(f"\n✓ Set {cur.rowcount} books to DRAFT (hidden from public)")

# Show what remains published
cur.execute("""
    SELECT b.slug,
           COUNT(DISTINCT l.id) as lessons,
           COUNT(DISTINCT m.id) as pdfs
    FROM books b
    LEFT JOIN lessons l ON l."bookId"=b.id AND l.status='PUBLISHED'
    LEFT JOIN media m ON m."bookId"=b.id AND m."mediaType"='PDF'
    WHERE b.status='PUBLISHED'
    GROUP BY b.slug
    ORDER BY lessons DESC, pdfs DESC
""")
remaining = cur.fetchall()
print(f"\nPublished books remaining: {len(remaining)}")
for r in remaining:
    print(f"  {r[0]}: lessons={r[1]}, pdfs={r[2]}")

cur.close()
conn.close()
