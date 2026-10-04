"""Link lessons to books via series. Usage: py scripts/fix_book_links.py"""
from _neon import connect

conn = connect()
cur  = conn.cursor()
cur.execute("""
    UPDATE lessons l SET "bookId"=s."bookId","updatedAt"=NOW()
    FROM series s
    WHERE l."seriesId"=s.id AND l."bookId" IS NULL AND s."bookId" IS NOT NULL
""")
print(f"Fixed bookId on {cur.rowcount} lessons")
conn.commit()
conn.close()
