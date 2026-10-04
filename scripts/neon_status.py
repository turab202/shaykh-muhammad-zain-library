"""Quick Neon DB status — run anytime to see live data counts.

Usage:
    py scripts/neon_status.py
"""
import os, psycopg2

NEON = (
    "postgresql://neondb_owner:npg_rf3wYTZ7EDVa"
    "@ep-damp-haze-b1r8bscu-pooler.c-5.eu-central-1.aws.neon.tech"
    "/neondb?sslmode=require&channel_binding=disable"
)

print("Connecting to Neon…")
try:
    conn = psycopg2.connect(NEON, connect_timeout=20)
except Exception as e:
    print(f"  ✗ {e}")
    raise SystemExit(1)

cur = conn.cursor()
print("Connected!\n")

rows = [
    ("lessons (PUBLISHED)", "SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'"),
    ("lessons (DRAFT)",     "SELECT COUNT(*) FROM lessons WHERE status='DRAFT'"),
    ("series",              "SELECT COUNT(*) FROM series WHERE status='PUBLISHED'"),
    ("books",               "SELECT COUNT(*) FROM books  WHERE status='PUBLISHED'"),
    ("categories",          "SELECT COUNT(*) FROM categories"),
    ("telegram_messages",   "SELECT COUNT(*) FROM telegram_messages"),
    ("  — pending review",  "SELECT COUNT(*) FROM telegram_messages WHERE \"processedAt\" IS NULL"),
    ("  — processed",       "SELECT COUNT(*) FROM telegram_messages WHERE \"processedAt\" IS NOT NULL"),
    ("media",               "SELECT COUNT(*) FROM media"),
]

for label, sql in rows:
    cur.execute(sql)
    print(f"  {label:<28} {cur.fetchone()[0]:>6}")

print()
cur.execute("SELECT slug, title FROM series WHERE status='PUBLISHED' ORDER BY \"order\"")
series = cur.fetchall()
if series:
    print("Published series:")
    for s in series:
        print(f"  • {s[0]:<35} {s[1]}")

conn.close()
print(f"\n► Live site: https://shaykh-muhammad-zain-library.vercel.app/en")
