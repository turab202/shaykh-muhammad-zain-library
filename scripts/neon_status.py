"""Quick Neon DB status. Usage: py scripts/neon_status.py"""
from _neon import connect

conn = connect()
cur = conn.cursor()
print("Connected!\n")

for label, sql in [
    ("lessons (PUBLISHED)", "SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'"),
    ("lessons (DRAFT)",     "SELECT COUNT(*) FROM lessons WHERE status='DRAFT'"),
    ("series (PUBLISHED)",  "SELECT COUNT(*) FROM series WHERE status='PUBLISHED'"),
    ("books (PUBLISHED)",   "SELECT COUNT(*) FROM books WHERE status='PUBLISHED'"),
    ("categories",          "SELECT COUNT(*) FROM categories"),
    ("telegram_messages",   "SELECT COUNT(*) FROM telegram_messages"),
    ("  — pending",         "SELECT COUNT(*) FROM telegram_messages WHERE \"processedAt\" IS NULL"),
    ("media",               "SELECT COUNT(*) FROM media"),
]:
    cur.execute(sql)
    print(f"  {label:<28} {cur.fetchone()[0]:>6}")

conn.close()
