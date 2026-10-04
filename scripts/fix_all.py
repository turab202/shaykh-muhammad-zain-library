"""
One-shot fix script:
1. Reset admin password
2. Fix book links (lessonId → bookId)
3. Show status

Usage: py scripts/fix_all.py
"""
import os, sys, bcrypt, secrets, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

# Load .env
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import psycopg2

url = os.environ["DATABASE_URL"]
# strip channel_binding if present, keep sslmode
if "channel_binding" in url:
    parts = url.split("?")
    base = parts[0]
    params = [p for p in parts[1].split("&") if not p.startswith("channel_binding")]
    url = base + "?" + "&".join(params)

print("Connecting to Neon...")
try:
    conn = psycopg2.connect(url, connect_timeout=20)
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)

cur = conn.cursor()
print("Connected!\n")

# 1. Reset admin
EMAIL = "admin@library.local"
PASSWORD = "Admin2026!"
h = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(12)).decode()
cur.execute("SELECT id FROM users WHERE email=%s", (EMAIL,))
if cur.fetchone():
    cur.execute('UPDATE users SET "passwordHash"=%s,"updatedAt"=NOW() WHERE email=%s', (h, EMAIL))
    print(f"✓ Admin password reset: {EMAIL} / {PASSWORD}")
else:
    uid = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(12)}"[:25]
    cur.execute(
        'INSERT INTO users (id,email,name,"passwordHash",role,"createdAt","updatedAt") VALUES (%s,%s,%s,%s,%s,NOW(),NOW())',
        (uid, EMAIL, "Admin", h, "ADMIN")
    )
    print(f"✓ Admin created: {EMAIL} / {PASSWORD}")

# 2. Fix book links
cur.execute("""
    UPDATE lessons l SET "bookId"=s."bookId","updatedAt"=NOW()
    FROM series s
    WHERE l."seriesId"=s.id AND l."bookId" IS NULL AND s."bookId" IS NOT NULL
""")
print(f"✓ Fixed bookId on {cur.rowcount} lessons")

conn.commit()

# 3. Status
for label, sql in [
    ("Published lessons", "SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'"),
    ("Published series",  "SELECT COUNT(*) FROM series WHERE status='PUBLISHED'"),
    ("Published books",   "SELECT COUNT(*) FROM books WHERE status='PUBLISHED'"),
    ("Categories",        "SELECT COUNT(*) FROM categories"),
    ("TG messages total", "SELECT COUNT(*) FROM telegram_messages"),
    ("TG pending review", "SELECT COUNT(*) FROM telegram_messages WHERE \"processedAt\" IS NULL"),
]:
    cur.execute(sql)
    print(f"  {label:<24} {cur.fetchone()[0]:>6}")

conn.close()
print(f"\n✓ Done!")
print(f"\n  Admin login: https://shaykh-muhammad-zain-library.vercel.app/en/login")
print(f"  Email      : {EMAIL}")
print(f"  Password   : {PASSWORD}")
