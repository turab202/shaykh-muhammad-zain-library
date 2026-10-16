# -*- coding: utf-8 -*-
"""Full status report — audio, series, pending work."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
total = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND \"audioFileKey\" IS NOT NULL")
with_audio = cur.fetchone()[0]

print(f"=== AUDIO STATUS ===")
print(f"Published lessons : {total}")
print(f"With B2 audio     : {with_audio}")
print(f"Need audio        : {total - with_audio}")
print(f"Coverage          : {with_audio/total*100:.1f}%")

print()
print("=== PER-SERIES (need audio first) ===")
cur.execute("""
    SELECT s.slug,
           COUNT(l.id) FILTER(WHERE l."audioFileKey" IS NOT NULL) as has,
           COUNT(l.id) as total
    FROM series s
    JOIN lessons l ON l."seriesId" = s.id
    WHERE l.status = 'PUBLISHED'
    GROUP BY s.slug
    ORDER BY (COUNT(l.id) - COUNT(l.id) FILTER(WHERE l."audioFileKey" IS NOT NULL)) DESC
""")
for r in cur.fetchall():
    missing = r[2] - r[1]
    bar = "#" * min(r[1] * 20 // max(r[2],1), 20)
    pct = r[1]*100//max(r[2],1)
    print(f"  {r[0]:40s}  {r[1]:4d}/{r[2]:4d}  ({pct:3d}%)  missing={missing}")

print()
print("=== BOOKS STATUS ===")
cur.execute("""
    SELECT b.slug, b.title,
           b."pdfFileKey" IS NOT NULL as has_pdf,
           b."coverImageKey" IS NOT NULL as has_cover
    FROM books b
    ORDER BY b.slug
""")
books = cur.fetchall()
print(f"Total books: {len(books)}")
no_pdf   = sum(1 for b in books if not b[2])
no_cover = sum(1 for b in books if not b[3])
print(f"  Without PDF  : {no_pdf}")
print(f"  Without cover: {no_cover}")
if no_pdf > 0:
    print("  Books missing PDF:")
    for b in books:
        if not b[2]:
            print(f"    {b[0]}  —  {b[1]}")

print()
print("=== SERIES WITHOUT BOOKS ===")
cur.execute("""
    SELECT s.slug, s.title, COUNT(l.id) as lessons
    FROM series s
    LEFT JOIN lessons l ON l."seriesId"=s.id AND l.status='PUBLISHED'
    WHERE s."bookId" IS NULL
    GROUP BY s.id, s.slug, s.title
    ORDER BY lessons DESC
""")
for r in cur.fetchall():
    print(f"  {r[0]:40s}  {r[2]} lessons")

cur.close()
conn.close()
