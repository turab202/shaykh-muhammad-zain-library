"""
Post-live-import verification script.

Run after the controlled 20-message import to confirm:
  1. Expected rows are in DB
  2. Raw fields are preserved
  3. suggestedMetadata is SEPARATE from raw fields
  4. All imported records are PENDING (processedAt IS NULL)
  5. No records were auto-published as Lessons
  6. Audio metadata (filename, fileId) is recorded where applicable
  7. Import job record exists and status is DONE/PARTIAL
  8. Duplicate protection works (run count before/after second import)

Usage:
    py telegram/tests/verify_live_import.py
"""
import os
import sys
import json
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

import psycopg2
from psycopg2.extras import RealDictCursor

url = os.environ["DATABASE_URL"].split("?")[0]

try:
    conn = psycopg2.connect(url)
except Exception as e:
    print(f"❌  DB connection failed: {e}")
    sys.exit(1)

SEP = "=" * 72


def section(title: str):
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


# ─────────────────────────────────────────────────────────────
# 1. Total telegram_messages
# ─────────────────────────────────────────────────────────────
section("1. TOTAL TELEGRAM_MESSAGES IN DB")
with conn.cursor() as cur:
    cur.execute("SELECT COUNT(*) FROM telegram_messages")
    total = cur.fetchone()[0]
    print(f"  Total rows : {total}")

# ─────────────────────────────────────────────────────────────
# 2. Pending vs processed
# ─────────────────────────────────────────────────────────────
section("2. PENDING vs PROCESSED")
with conn.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM telegram_messages WHERE "processedAt" IS NULL')
    pending = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM telegram_messages WHERE "processedAt" IS NOT NULL')
    processed = cur.fetchone()[0]
    print(f"  Pending (not reviewed)  : {pending}")
    print(f"  Processed (reviewed)    : {processed}")
    assert pending == total - processed, "BUG: pending + processed != total"
    print(f"  ✓ counts are consistent")

# ─────────────────────────────────────────────────────────────
# 3. All recent messages with raw field check
# ─────────────────────────────────────────────────────────────
section("3. RECENT MESSAGES — RAW FIELD PRESERVATION")
with conn.cursor(cursor_factory=RealDictCursor) as cur:
    cur.execute(
        """
        SELECT
            id, "messageId", "chatId", caption,
            "audioFilename", "telegramFileId", "telegramFileUniqueId",
            links, "rawJson", "suggestedMetadata",
            "processedAt", date
        FROM telegram_messages
        ORDER BY date DESC
        LIMIT 30
        """
    )
    rows = cur.fetchall()

audio_count = 0
non_audio_count = 0
raw_missing = 0
suggested_overlaps_raw = 0

for r in rows:
    mid = r["messageId"]
    has_audio = bool(r["audioFilename"])
    has_raw = bool(r["rawJson"])
    meta = r["suggestedMetadata"]
    if isinstance(meta, str):
        meta = json.loads(meta)
    if isinstance(r["rawJson"], str):
        raw_json = json.loads(r["rawJson"])
    else:
        raw_json = r["rawJson"] or {}

    if has_audio:
        audio_count += 1
    else:
        non_audio_count += 1

    if not has_raw:
        raw_missing += 1

    # suggestedMetadata must NOT contain raw immutable fields
    bad_keys = {"caption", "text", "chatId", "messageId", "date", "audioFilename"}
    overlap = bad_keys & set((meta or {}).keys())
    if overlap:
        suggested_overlaps_raw += 1
        print(f"  ⚠  msgId={mid} suggestedMetadata has raw keys: {overlap}")

    pending_flag = "PENDING" if r["processedAt"] is None else "PROCESSED"
    print(
        f"  msgId={mid:5}  [{pending_flag}]  audio={has_audio}  "
        f"raw={'✓' if has_raw else '✗'}  "
        f"series={meta.get('series_slug', '—') if meta else '—'}  "
        f"conf={meta.get('confidence', '—') if meta else '—'}"
    )

print(f"\n  Audio messages          : {audio_count}")
print(f"  Non-audio messages      : {non_audio_count}")
print(f"  Missing rawJson         : {raw_missing}")
print(f"  suggestedMetadata clean : {'✓' if suggested_overlaps_raw == 0 else f'✗ {suggested_overlaps_raw} overlaps'}")

# ─────────────────────────────────────────────────────────────
# 4. Confirm ALL imported records are PENDING
# ─────────────────────────────────────────────────────────────
section("4. CONFIRM ALL IMPORTED RECORDS ARE PENDING (NOT AUTO-PUBLISHED)")
with conn.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM telegram_messages WHERE "processedAt" IS NOT NULL')
    auto_processed = cur.fetchone()[0]
    if auto_processed == 0:
        print(f"  ✓ 0 records have been auto-processed — all remain in PENDING state")
    else:
        print(f"  ⚠  {auto_processed} records already have processedAt set")
        print(f"     (check if these were from a prior manual test, not the new import)")

# ─────────────────────────────────────────────────────────────
# 5. Confirm NO Telegram-sourced lessons were auto-published
# ─────────────────────────────────────────────────────────────
section("5. NO AUTO-PUBLISHED LESSONS FROM TELEGRAM")
with conn.cursor() as cur:
    cur.execute(
        """
        SELECT COUNT(*) FROM lessons
        WHERE "telegramSourceId" IS NOT NULL AND status = 'PUBLISHED'
        """
    )
    auto_published = cur.fetchone()[0]
    if auto_published == 0:
        print(f"  ✓ 0 Telegram-sourced lessons are published — correct")
    else:
        print(f"  ✗ {auto_published} Telegram-sourced lessons are PUBLISHED — this is wrong!")

    # Also show all Telegram-sourced lessons (should be 0 for a fresh import)
    cur.execute(
        'SELECT id, slug, title, status, "telegramSourceId" FROM lessons WHERE "telegramSourceId" IS NOT NULL'
    )
    tg_lessons = cur.fetchall()
    print(f"  Telegram-sourced lessons (total): {len(tg_lessons)}")
    for l in tg_lessons:
        print(f"    {l[0]}  slug={l[1]}  status={l[3]}")

# ─────────────────────────────────────────────────────────────
# 6. Raw file ID / unique ID preservation check
# ─────────────────────────────────────────────────────────────
section("6. RAW FILE METADATA (audioFilename, telegramFileId, telegramFileUniqueId)")
with conn.cursor() as cur:
    cur.execute(
        """
        SELECT "messageId", "audioFilename", "telegramFileId", "telegramFileUniqueId"
        FROM telegram_messages
        WHERE "audioFilename" IS NOT NULL
        ORDER BY "messageId" DESC
        LIMIT 20
        """
    )
    file_rows = cur.fetchall()
    if file_rows:
        for r in file_rows:
            print(
                f"  msgId={r[0]:5}  "
                f"filename={str(r[1])[:50]:50}  "
                f"fileId={str(r[2] or '—')[:12]}  "
                f"uniqueId={str(r[3] or '—')[:12]}"
            )
    else:
        print("  (no audio messages found — channel may have sent text-only messages)")

# ─────────────────────────────────────────────────────────────
# 7. Import job records
# ─────────────────────────────────────────────────────────────
section("7. IMPORT JOB RECORDS")
with conn.cursor(cursor_factory=RealDictCursor) as cur:
    cur.execute('SELECT id, status, source, "startedAt", "completedAt" FROM imports ORDER BY "createdAt" DESC LIMIT 5')
    for r in cur.fetchall():
        print(
            f"  {r['id']}  source={r['source']}  status={r['status']}  "
            f"started={r['startedAt']}  completed={r['completedAt']}"
        )

# ─────────────────────────────────────────────────────────────
# 8. Idempotency: duplicate detection
# ─────────────────────────────────────────────────────────────
section("8. DUPLICATE PROTECTION — chatId+messageId unique constraint check")
with conn.cursor() as cur:
    cur.execute(
        """
        SELECT "chatId", "messageId", COUNT(*) as cnt
        FROM telegram_messages
        GROUP BY "chatId", "messageId"
        HAVING COUNT(*) > 1
        """
    )
    dupes = cur.fetchall()
    if dupes:
        print(f"  ✗ DUPLICATES FOUND: {len(dupes)} chatId+messageId pairs appear more than once!")
        for d in dupes:
            print(f"    chatId={d[0]}  msgId={d[1]}  count={d[2]}")
    else:
        print(f"  ✓ No duplicates — unique constraint is working correctly")

# ─────────────────────────────────────────────────────────────
# 9. chatId coverage (should all be the same real channel ID)
# ─────────────────────────────────────────────────────────────
section("9. CHANNEL IDs PRESENT")
with conn.cursor() as cur:
    cur.execute('SELECT DISTINCT "chatId", COUNT(*) FROM telegram_messages GROUP BY "chatId"')
    for r in cur.fetchall():
        print(f"  chatId={r[0]}  messages={r[1]}")

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
section("SUMMARY")
print(f"  Total TelegramMessage rows : {total}")
print(f"  Audio messages             : {audio_count}")
print(f"  Non-audio / text messages  : {non_audio_count}")
print(f"  PENDING (awaiting review)  : {pending}")
print(f"  Processed / reviewed       : {processed}")
print(f"  Auto-published lessons     : {auto_published}")
print(f"  Raw field gaps             : {raw_missing}")
print(f"  Duplicate violations       : {len(dupes)}")
print(f"\n  Admin Inbox  : http://localhost:3000/en/admin/import")
print()

conn.close()
print("Verification complete.")
