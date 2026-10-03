"""
Full one-time archive import.

Does everything in the right order:
  1. Verifies Docker/PostgreSQL is running
  2. Wipes ALL seed/sample content (lessons, media, series, books, categories)
     keeping only the admin user
  3. Runs the live Telegram importer with --auto-publish
     This downloads audio, creates categories/books/series/lessons
     all as PUBLISHED
  4. Prints a summary

Run with:
    py scripts/full_import.py

After it completes, open http://localhost:3000 — the real archive is live.
"""

import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SEP = "=" * 62


def section(t):
    print(f"\n{SEP}\n  {t}\n{SEP}")


# ── 1. Check DB connection ─────────────────────────────────
section("1. Checking database connection")
try:
    import psycopg2
    conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
    cur = conn.cursor()
    cur.execute("SELECT 1")
    print("  ✓ PostgreSQL is running")
except Exception as e:
    print(f"  ✗ Cannot connect: {e}")
    print("\n  ► Start Docker Desktop and wait for it to finish loading,")
    print("    then re-run this script.")
    sys.exit(1)

# ── 2. Wipe all sample/seed content ───────────────────────
section("2. Removing all sample/seed content")

# Order matters — FK constraints
steps = [
    ("lesson_tags",      "DELETE FROM lesson_tags"),
    ("media",            "DELETE FROM media"),
    ("lessons",          "DELETE FROM lessons"),
    ("telegram_messages","DELETE FROM telegram_messages"),
    ("imports",          "DELETE FROM imports"),
    ("series",           "DELETE FROM series"),
    ("books",            "DELETE FROM books"),
    ("categories",       "DELETE FROM categories"),
    ("tags",             "DELETE FROM tags"),
]

for label, sql in steps:
    cur.execute(sql)
    print(f"  Deleted {cur.rowcount:>4} rows from {label}")

conn.commit()
conn.close()
print("  ✓ Database is clean — only the admin user remains")

# ── 3. Run the live Telegram importer ─────────────────────
section("3. Running full Telegram import (with audio + auto-publish)")
print("  This will:")
print("    • Connect to @SheikhMuhammedZain via Telegram")
print("    • Download ALL audio files (may take 30–120 min depending on internet)")
print("    • Auto-create categories, books, series")
print("    • Publish every lesson with confidence >= 60% directly to the website")
print("    • Leave low-confidence messages in the admin inbox for manual review")
print()
print("  Press Ctrl+C at any time to stop — already-processed messages are saved.")
print()

cmd = [
    sys.executable, "-m", "telegram.importer.importer",
    "--live",
    "--limit", "3500",   # fetch up to 3500 messages (full archive)
    "--auto-publish",
]

print(f"  Running: {' '.join(cmd)}\n")
result = subprocess.run(cmd, cwd=str(ROOT))

# ── 4. Summary ─────────────────────────────────────────────
section("4. Import complete")

try:
    import psycopg2
    conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM lessons WHERE status = 'PUBLISHED'")
    lessons = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM series WHERE status = 'PUBLISHED'")
    series = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM books WHERE status = 'PUBLISHED'")
    books = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM categories")
    categories = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM media")
    media = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM telegram_messages WHERE "processedAt" IS NULL')
    pending = cur.fetchone()[0]
    conn.close()

    print(f"  Published lessons  : {lessons}")
    print(f"  Published series   : {series}")
    print(f"  Published books    : {books}")
    print(f"  Categories         : {categories}")
    print(f"  Media files        : {media}")
    print(f"  Still in inbox     : {pending}  ← low-confidence, review manually")
    print()
    print("  ► Open http://localhost:3000 — your real archive is live!")
    if pending > 0:
        print(f"  ► Review {pending} low-confidence messages at:")
        print("    http://localhost:3000/en/admin/import")
except Exception as e:
    print(f"  (could not fetch summary: {e})")

sys.exit(result.returncode)
