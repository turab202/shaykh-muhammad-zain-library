"""
Setup Neon: check tables, create admin user, show DB state.

Usage:
    $env:NEON_URL="postgresql://..."
    py scripts/setup_neon.py
"""
import os, sys, bcrypt
import psycopg2
from pathlib import Path

NEON_URL = os.environ.get("NEON_URL") or os.environ.get("DATABASE_URL", "")
if not NEON_URL:
    print("Set NEON_URL env var first.")
    sys.exit(1)

print(f"Connecting to Neon...")
try:
    conn = psycopg2.connect(NEON_URL, connect_timeout=30)
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)

cur = conn.cursor()
print("Connected!\n")

# Check tables
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables ({len(tables)}): {', '.join(tables) if tables else 'NONE'}")

if not tables:
    print("\nERROR: No tables — migration hasn't run yet.")
    print("Check Vercel build log at: https://vercel.com")
    conn.close()
    sys.exit(1)

# Check/create admin user
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@library.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "ZainLibrary2026!")

cur.execute("SELECT id, email FROM users WHERE email = %s", (ADMIN_EMAIL,))
existing = cur.fetchone()
if existing:
    print(f"\nAdmin user already exists: {existing[1]}")
else:
    pwd_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt(12)).decode()
    # generate cuid-style id
    import secrets, time
    ts = int(time.time() * 1000)
    rand = secrets.token_urlsafe(16)
    uid = f"c{ts:x}{rand}"[:25]
    cur.execute(
        """INSERT INTO users (id, email, name, "passwordHash", role, "createdAt", "updatedAt")
           VALUES (%s,%s,'Admin',%s,'ADMIN',NOW(),NOW())""",
        (uid, ADMIN_EMAIL, pwd_hash)
    )
    conn.commit()
    print(f"\n✓ Admin user created: {ADMIN_EMAIL}")
    print(f"  Password: {ADMIN_PASSWORD}")
    print(f"  ⚠ Change this password after first login!")

# Stats
for table in ["lessons", "series", "books", "categories", "telegram_messages"]:
    if table in tables:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"  {table}: {cur.fetchone()[0]} rows")

conn.close()
print(f"\n✓ Neon is ready.")
print(f"\nLogin at: https://shaykh-muhammad-zain-library.vercel.app/en/login")
print(f"  Email:    {ADMIN_EMAIL}")
print(f"  Password: {ADMIN_PASSWORD}")
