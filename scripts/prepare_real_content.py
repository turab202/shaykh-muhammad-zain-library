"""
All-in-one preparation script.
Run this ONCE after Docker Desktop is started.

What it does:
  1. Verifies DB connection
  2. Deletes all sample/seed lessons and media
  3. Resets any PROCESSING import jobs to FAILED
  4. Shows current state
  5. Confirms you are ready to run the live import

Usage:
    py scripts/prepare_real_content.py
"""
import psycopg2
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SEP = "=" * 60

def section(title):
    print(f"\n{SEP}\n  {title}\n{SEP}")

# ── 1. Connect ─────────────────────────────────────────────
section("1. Connecting to PostgreSQL")
try:
    conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
    print("  ✓ Connected to PostgreSQL")
except Exception as e:
    print(f"  ✗ Connection failed: {e}")
    print("\n  Is Docker Desktop running?")
    print("  Start Docker Desktop, wait for it to fully load, then re-run this script.")
    sys.exit(1)

cur = conn.cursor()

# ── 2. Delete seed lessons and media ──────────────────────
section("2. Removing seed (sample) data")
cur.execute("DELETE FROM media WHERE id LIKE 'media-audio-%'")
print(f"  Deleted {cur.rowcount} seed media records")

seed_prefixes = [
    "riyad-as-salihin-0",
    "tafsir-ibn-kathir-0",
    "al-aqeedah-al-wasitiyyah-0",
    "al-ajrumiyyah-0",
]
for prefix in seed_prefixes:
    cur.execute("DELETE FROM lessons WHERE slug LIKE %s", (f"{prefix}%",))
    if cur.rowcount:
        print(f"  Deleted {cur.rowcount} lessons: {prefix}*")

# Delete any malformed DRAFT lessons (empty title, slug starts with -)
cur.execute("DELETE FROM lessons WHERE status = 'DRAFT' AND (title = '' OR slug LIKE '-%')")
if cur.rowcount:
    print(f"  Deleted {cur.rowcount} malformed draft lessons")

# Delete all Telegram-sourced DRAFTs (will re-approve cleanly from inbox)
cur.execute("""
    DELETE FROM lessons
    WHERE status = 'DRAFT'
    AND "telegramSourceId" IS NOT NULL
""")
if cur.rowcount:
    print(f"  Deleted {cur.rowcount} draft telegram lessons (will re-approve from inbox)")

conn.commit()

# ── 3. Reset stale PROCESSING import jobs ─────────────────
section("3. Fixing stale import jobs")
cur.execute("""
    UPDATE imports SET status = 'FAILED', "completedAt" = NOW()
    WHERE status = 'PROCESSING'
""")
print(f"  Reset {cur.rowcount} stale PROCESSING imports to FAILED")
conn.commit()

# ── 4. Show current state ──────────────────────────────────
section("4. Current database state")
cur.execute("SELECT COUNT(*) FROM lessons")
print(f"  Lessons         : {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM media")
print(f"  Media records   : {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM telegram_messages")
print(f"  Telegram messages (inbox): {cur.fetchone()[0]}")
cur.execute('SELECT COUNT(*) FROM telegram_messages WHERE "chatId" = %s', ("1747155048",))
print(f"  Real channel messages    : {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM series WHERE status = 'PUBLISHED'")
print(f"  Published series : {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM categories")
print(f"  Categories       : {cur.fetchone()[0]}")

conn.close()

# ── 5. Next steps ──────────────────────────────────────────
section("5. READY — next steps")
print("""
  Database is clean. Now run:

  A) Pull latest messages from Telegram (fast, no audio):
     py -m telegram.importer.importer --live --limit 200 --no-media

  B) Then open the admin inbox and approve messages:
     http://localhost:3000/en/admin/import

  C) To download real audio files (slow, run overnight if needed):
     py -m telegram.importer.importer --live --limit 200

  D) Then publish approved lessons from:
     http://localhost:3000/en/admin/lessons
""")
