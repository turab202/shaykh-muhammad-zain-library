"""Fix stale PROCESSING import records left by failed runs."""
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
import psycopg2

url = os.environ["DATABASE_URL"].split("?")[0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("""UPDATE imports SET status = 'FAILED', "completedAt" = NOW() WHERE status = 'PROCESSING'""")
print(f"Fixed {cur.rowcount} stale PROCESSING import(s)")
conn.commit()

cur.execute("SELECT COUNT(*) FROM telegram_messages")
print(f"TelegramMessage rows: {cur.fetchone()[0]}")

cur.execute("""SELECT id, status FROM imports ORDER BY "createdAt" DESC LIMIT 5""")
for r in cur.fetchall():
    print(f"  {r[0][:25]}  status={r[1]}")

conn.close()
print("Done.")
