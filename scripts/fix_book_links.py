"""
Fix bookId on lessons that were imported without it.
Sets lesson.bookId = series.bookId for all lessons where bookId is NULL
but the lesson's series has a bookId.
"""
import psycopg2, os

NEON = "postgresql://neondb_owner:npg_rf3wYTZ7EDVa@ep-damp-haze-b1r8bscu-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=disable"
conn = psycopg2.connect(NEON, connect_timeout=20)
cur = conn.cursor()

cur.execute("""
    UPDATE lessons l
    SET "bookId" = s."bookId", "updatedAt" = NOW()
    FROM series s
    WHERE l."seriesId" = s.id
      AND l."bookId" IS NULL
      AND s."bookId" IS NOT NULL
""")
print(f"Fixed bookId on {cur.rowcount} lessons")
conn.commit()

# Verify
cur.execute("""
    SELECT s.slug, COUNT(l.id) as cnt
    FROM lessons l
    JOIN series s ON l."seriesId" = s.id
    JOIN books b ON l."bookId" = b.id
    GROUP BY s.slug ORDER BY cnt DESC
""")
print("\nLessons linked to books by series:")
for r in cur.fetchall():
    print(f"  {r[0]:<35} {r[1]} lessons")

conn.close()
print("\n✓ Done — books will now show lesson counts on the live site.")
