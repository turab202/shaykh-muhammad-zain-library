"""Verify what the admin Import Inbox page will render."""
import json, os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
import psycopg2

url = os.environ["DATABASE_URL"].split("?")[0]
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("""
    SELECT id, "messageId", "chatId", caption, "audioFilename",
           "telegramFileUniqueId", "suggestedMetadata", date, "processedAt"
    FROM telegram_messages
    WHERE "processedAt" IS NULL
    ORDER BY date DESC
""")
rows = cur.fetchall()

print(f"\nAdmin Import Inbox — pending messages: {len(rows)}")
print("=" * 68)

real   = [r for r in rows if str(r[2]) == "1747155048"]
other  = [r for r in rows if str(r[2]) != "1747155048"]

print(f"Real @SheikhMuhammedZain (chatId=1747155048) : {len(real)}")
print(f"Fixture/test messages                        : {len(other)}")
print()

print("=== REAL MESSAGES IN INBOX ===")
for r in real:
    meta = r[6] if isinstance(r[6], dict) else (json.loads(r[6]) if r[6] else {})
    cap  = (r[3] or "")[:60] or "(empty caption)"
    fn   = r[4] or "(no audio file)"
    series = meta.get("series_slug") or "?"
    conf   = meta.get("confidence", "?")
    print(f"\n  msgId={r[1]:5}  chatId={r[2]}  date={str(r[8])[:10]}")
    print(f"  Raw audio file : {fn[:70]}")
    print(f"  Raw caption    : {cap}")
    print(f"  Suggested      : series={series}  confidence={conf}")
    print(f"  processedAt    : {r[8]}  (None = PENDING)")

# Confirm raw vs suggested separation
cur.execute("""
    SELECT "messageId", "audioFilename", "telegramFileId", "telegramFileUniqueId",
           "rawJson" IS NOT NULL as has_raw
    FROM telegram_messages
    WHERE "chatId" = '1747155048'
    ORDER BY "messageId" DESC
    LIMIT 5
""")
print("\n=== RAW FIELD SEPARATION (top 5) ===")
for r in cur.fetchall():
    print(f"  msgId={r[0]:5}  file={str(r[1])[:45]:45}  fileId={str(r[2])[:12]}  rawJson={'✓' if r[4] else '✗'}")

# Confirm no auto-published lessons
cur.execute("""SELECT COUNT(*) FROM lessons WHERE "telegramSourceId" IS NOT NULL""")
tg_lessons = cur.fetchone()[0]

print(f"\n=== PUBLISHED LESSONS FROM TELEGRAM: {tg_lessons} (must be 0) ===")
if tg_lessons == 0:
    print("  ✓ No lessons auto-published — admin approval required")
else:
    print(f"  ✗ {tg_lessons} lessons exist — check if they are DRAFT")

print(f"\nAdmin Inbox URL: http://localhost:3000/en/admin/import")
conn.close()
print("\nCheck complete.")
