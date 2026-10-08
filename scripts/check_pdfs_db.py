"""Check PDF messages in telegram_messages."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

print("PDF files in telegram_messages:")
cur.execute("""
    SELECT tm."messageId", tm."audioFilename", tm."chatId"
    FROM telegram_messages tm
    WHERE tm."audioFilename" ILIKE '%.pdf'
    ORDER BY tm."messageId" DESC
""")
rows = cur.fetchall()
print(f"Total: {len(rows)}")
for r in rows:
    print(f"  msgId={r[0]}  file={str(r[1])[:60]}")

print()
print("PDF media records already in DB:")
cur.execute("""
    SELECT m.id, m.filename, m."storageKey", m."bookId",
           b.slug as book_slug
    FROM media m
    LEFT JOIN books b ON m."bookId" = b.id
    WHERE m."mediaType" = 'PDF'
""")
rows2 = cur.fetchall()
print(f"Total: {len(rows2)}")
for r in rows2:
    print(f"  {r[1][:50]}  key={str(r[2])[:40]}  book={r[4]}")

cur.close()
conn.close()
