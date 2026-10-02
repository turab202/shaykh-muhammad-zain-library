"""
Quick DB verification script — run after offline pipeline test.
Usage: py telegram/tests/verify_db.py
"""
import os
import sys
import json
from pathlib import Path

# Load .env from project root
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

import psycopg2

url = os.environ["DATABASE_URL"].split("?")[0]

try:
    conn = psycopg2.connect(url)
except Exception as e:
    print(f"DB connection failed: {e}")
    sys.exit(1)

cur = conn.cursor()

# ── TelegramMessage records ───────────────────────────────
cur.execute(
    'SELECT "messageId", "chatId", caption, "processedAt", '
    '"suggestedMetadata", "rawJson" '
    'FROM telegram_messages ORDER BY "messageId"'
)
rows = cur.fetchall()

print(f"\n{'='*70}")
print(f"  TelegramMessage records in database: {len(rows)}")
print(f"{'='*70}")

for r in rows:
    msg_id, chat_id, caption, processed_at, meta, raw = r
    if isinstance(meta, str):
        meta = json.loads(meta)
    if isinstance(raw, str):
        raw = json.loads(raw)

    status = "REVIEWED" if processed_at else "PENDING"
    print(f"\n  msgId={msg_id}  chatId={chat_id}  [{status}]")
    print(f"  caption : {str(caption or '')[:70]}")
    print(f"  series  : {meta.get('series_slug', '—')}")
    print(f"  category: {meta.get('category_slug', '—')}")
    print(f"  lesson# : {meta.get('lesson_number', '—')}")
    print(f"  conf    : {meta.get('confidence', '—')}")
    print(f"  rawJson : {'present (' + str(len(json.dumps(raw))) + ' chars)' if raw else 'MISSING'}")

# ── Raw field preservation check ─────────────────────────
print(f"\n{'='*70}")
print("  RAW FIELD PRESERVATION CHECK")
print(f"{'='*70}")
cur.execute('SELECT "messageId", caption, "audioFilename", "telegramFileUniqueId" FROM telegram_messages')
for r in cur.fetchall():
    msg_id, cap, audio_fn, tg_uid = r
    print(f"  msgId={msg_id:5}  audioFilename={audio_fn or '—':30}  uniqueId={tg_uid or '—'}")

# ── Import job records ────────────────────────────────────
print(f"\n{'='*70}")
print("  IMPORT JOB RECORDS")
print(f"{'='*70}")
cur.execute('SELECT id, status, "startedAt", "completedAt" FROM imports ORDER BY "createdAt"')
for r in cur.fetchall():
    imp_id, status, started, completed = r
    print(f"  {imp_id}  status={status}  started={started}  completed={completed}")

# ── Media records ─────────────────────────────────────────
print(f"\n{'='*70}")
print("  MEDIA RECORDS")
print(f"{'='*70}")
cur.execute('SELECT id, filename, "mimeType", size, "storageKey", "lessonId" FROM media ORDER BY "createdAt" DESC LIMIT 10')
media_rows = cur.fetchall()
if media_rows:
    for r in media_rows:
        print(f"  {r[0]}  {r[1]}  {r[2]}  {r[3]}B  key={r[4]}  lessonId={r[5]}")
else:
    print("  (no media records yet — media is stored when files are downloaded)")

# ── Pending inbox count ───────────────────────────────────
cur.execute('SELECT COUNT(*) FROM telegram_messages WHERE "processedAt" IS NULL')
pending = cur.fetchone()[0]
print(f"\n{'='*70}")
print(f"  IMPORT INBOX: {pending} message(s) pending admin review")
print(f"  Open: http://localhost:3000/en/admin/import")
print(f"{'='*70}\n")

conn.close()
print("Verification complete.")
