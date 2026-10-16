import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()
cur.execute("SELECT id FROM books WHERE slug='tafsir-al-saadi'")
row = cur.fetchone()
if row:
    book_id = row[0]
    cur.execute("UPDATE series SET \"bookId\"=%s WHERE slug='tafsir-al-saadi'", (book_id,))
    print(f"Linked tafsir-al-saadi series to book: {cur.rowcount} rows")
    conn.commit()
else:
    print("Book not found")
cur.close(); conn.close()
