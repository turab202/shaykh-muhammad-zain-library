"""Delete any DRAFT lessons that came from Telegram but have no real title."""
import psycopg2, os
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
cur = conn.cursor()

# Delete DRAFT lessons whose slug starts with '-' (malformed from empty title)
cur.execute("DELETE FROM lessons WHERE slug LIKE '-%' AND status = 'DRAFT'")
print(f"Deleted {cur.rowcount} malformed draft lessons")

# Also delete any DRAFT telegram-sourced lessons (we'll re-approve properly)
cur.execute("""DELETE FROM lessons WHERE status = 'DRAFT' AND "telegramSourceId" IS NOT NULL""")
print(f"Deleted {cur.rowcount} draft telegram lessons (will re-approve from inbox)")

conn.commit()
cur.execute("SELECT COUNT(*) FROM lessons")
print(f"Lessons remaining: {cur.fetchone()[0]}")
conn.close()
