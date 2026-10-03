"""Check Neon DB state and create admin user."""
import os, sys
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Use NEON_URL if set, else fall back to DATABASE_URL
NEON_URL = os.environ.get("NEON_URL") or os.environ.get("DATABASE_URL")
if not NEON_URL:
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    NEON_URL = os.environ.get("DATABASE_URL")

print(f"Connecting to Neon...")
conn = psycopg2.connect(NEON_URL)
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")
tables = cur.fetchone()[0]
print(f"Tables in Neon DB: {tables}")

if tables == 0:
    print("ERROR: No tables found — Prisma migration may not have run yet.")
    print("Check the Vercel build log.")
    sys.exit(1)

cur.execute("SELECT COUNT(*) FROM users")
users = cur.fetchone()[0]
print(f"Existing users: {users}")

cur.execute("SELECT COUNT(*) FROM lessons")
lessons = cur.fetchone()[0]
print(f"Existing lessons: {lessons}")

conn.close()
print("OK — Neon is ready.")
