# -*- coding: utf-8 -*-
"""
Fix lessons that have no categoryId by inheriting from their series.
Also fix lessons that have no bookId by inheriting from their series.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# 1. Count lessons with missing categoryId
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND \"categoryId\" IS NULL")
no_cat = cur.fetchone()[0]
print(f"Lessons without categoryId: {no_cat}")

# 2. Bulk fix: inherit categoryId from series
cur.execute("""
    UPDATE lessons l
    SET "categoryId" = s."categoryId",
        "updatedAt" = NOW()
    FROM series s
    WHERE l."seriesId" = s.id
      AND l.status = 'PUBLISHED'
      AND l."categoryId" IS NULL
      AND s."categoryId" IS NOT NULL
""")
fixed_cat = cur.rowcount
conn.commit()
print(f"Fixed categoryId on {fixed_cat} lessons")

# 3. Count lessons with missing bookId
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND \"bookId\" IS NULL")
no_book = cur.fetchone()[0]
print(f"Lessons without bookId: {no_book}")

# 4. Bulk fix: inherit bookId from series
cur.execute("""
    UPDATE lessons l
    SET "bookId" = s."bookId",
        "updatedAt" = NOW()
    FROM series s
    WHERE l."seriesId" = s.id
      AND l.status = 'PUBLISHED'
      AND l."bookId" IS NULL
      AND s."bookId" IS NOT NULL
""")
fixed_book = cur.rowcount
conn.commit()
print(f"Fixed bookId on {fixed_book} lessons")

# 5. Verify
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND \"categoryId\" IS NULL")
print(f"Remaining without categoryId: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND \"bookId\" IS NULL")
print(f"Remaining without bookId: {cur.fetchone()[0]}")

# 6. Category lesson counts after fix
print("\nCategory lesson counts (after fix):")
cur.execute("""
    SELECT c.slug, c.name, COUNT(l.id) as lessons
    FROM categories c
    LEFT JOIN lessons l ON l."categoryId" = c.id AND l.status = 'PUBLISHED'
    GROUP BY c.id, c.slug, c.name
    ORDER BY lessons DESC
""")
for r in cur.fetchall():
    print(f"  {r[0]:30s}  {r[2]:5d} lessons")

cur.close()
conn.close()
print("\nDone.")
