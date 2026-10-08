"""Check PDF media records in DB."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()
cur.execute("""
    SELECT m.filename, m."storageKey", m."bookId", m."mediaType",
           b.slug as book_slug
    FROM media m
    LEFT JOIN books b ON m."bookId" = b.id
    WHERE m."mediaType" = 'PDF'
    ORDER BY m."createdAt" DESC
""")
rows = cur.fetchall()
print(f"PDF media records: {len(rows)}")
for r in rows:
    print(f"  {r[0][:50]}")
    print(f"    key    : {str(r[1])[:60]}")
    print(f"    bookId : {r[2]} ({r[4]})")
conn.close()
