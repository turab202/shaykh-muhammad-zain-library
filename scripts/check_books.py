"""Check books/series/categories in Neon. Usage: py scripts/check_books.py"""
from _neon import connect

conn = connect()
cur  = conn.cursor()
cur.execute("SELECT slug, title, status FROM books ORDER BY title")
print("Books:"); [print(f"  [{r[2]}] {r[0]}") for r in cur.fetchall()]
cur.execute("SELECT slug, title, status FROM series ORDER BY \"order\"")
print("\nSeries:"); [print(f"  [{r[2]}] {r[0]}") for r in cur.fetchall()]
cur.execute("SELECT slug, name FROM categories ORDER BY name")
print("\nCategories:"); [print(f"  {r[0]}") for r in cur.fetchall()]
conn.close()
