import psycopg2, os
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
cur = conn.cursor()
cur.execute('SELECT slug, title, status, "telegramSourceId" FROM lessons ORDER BY "createdAt"')
rows = cur.fetchall()
print(f"Total lessons: {len(rows)}")
for r in rows:
    print(f"  [{r[2]}] {r[0][:60]}  src={r[3]}")
conn.close()
