# -*- coding: utf-8 -*-
"""
Clean the admin import inbox:
1. Dismiss all non-lesson messages (live announcements, greetings, stickers, PDFs)
2. Re-parse audio messages with updated parser
3. Auto-publish all audio messages that now have a recognized series
"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from _neon import connect
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

conn = connect()
cur = conn.cursor()

# ── 1. Dismiss all non-audio messages (live, announcements, stickers) ──────
cur.execute("""
    UPDATE telegram_messages
    SET "processedAt" = NOW()
    WHERE "processedAt" IS NULL
      AND (
        "audioFilename" IS NULL
        OR lower("audioFilename") LIKE '%.pdf'
        OR lower("audioFilename") LIKE '%.webp'
        OR lower("audioFilename") LIKE '%.apk'
        OR lower("audioFilename") LIKE '%.jpg'
        OR lower("audioFilename") LIKE '%.jpeg'
        OR lower("audioFilename") LIKE '%.png'
      )
""")
dismissed = cur.rowcount
conn.commit()
print(f"Dismissed {dismissed} non-audio messages (live, announcements, stickers, PDFs)")

# ── 2. Re-parse remaining audio messages with updated parser ─────────────────
from telegram.importer.parser import parse_caption

cur.execute("""
    SELECT id, "messageId", "audioFilename", caption, "suggestedMetadata", date
    FROM telegram_messages
    WHERE "processedAt" IS NULL
      AND "audioFilename" IS NOT NULL
""")
audio_msgs = cur.fetchall()
print(f"\nAudio messages remaining: {len(audio_msgs)}")

updates = []
publishable_ids = []

for tm_id, msg_id, audio_fn, caption, old_meta, msg_date in audio_msgs:
    new_meta = parse_caption(caption, audio_fn)
    new_meta_dict = new_meta.to_dict()
    
    updates.append((json.dumps(new_meta_dict), tm_id))
    
    if new_meta.series_slug and new_meta.confidence >= 0.6:
        publishable_ids.append((tm_id, new_meta_dict, msg_date))

# Bulk update metadata
if updates:
    cur.executemany(
        'UPDATE telegram_messages SET "suggestedMetadata"=%s WHERE id=%s',
        updates
    )
    conn.commit()
    print(f"Re-parsed {len(updates)} audio messages")
    print(f"Now publishable: {len(publishable_ids)}")

# ── 3. Auto-publish all that qualify ─────────────────────────────────────────
from telegram.importer.publisher import auto_publish_message
from telegram.importer.database import ImportDB
import os

db = ImportDB(os.environ["DATABASE_URL"])

published = 0
failed = 0

print(f"\nPublishing {len(publishable_ids)} lessons...")

for i, (tm_id, meta, msg_date) in enumerate(publishable_ids):
    try:
        lesson_id = auto_publish_message(
            db=db,
            telegram_msg_id=tm_id,
            suggested=meta,
            message_date=msg_date,
            storage_key=None,
        )
        if lesson_id:
            cur.execute(
                'UPDATE telegram_messages SET "processedAt"=NOW() WHERE id=%s',
                (tm_id,)
            )
            published += 1
        else:
            # Still dismiss it (duplicate or no series)
            cur.execute(
                'UPDATE telegram_messages SET "processedAt"=NOW() WHERE id=%s',
                (tm_id,)
            )

        if (i + 1) % 100 == 0:
            conn.commit()
            print(f"  {i+1}/{len(publishable_ids)} processed...", flush=True)

    except Exception as e:
        failed += 1
        if failed <= 3:
            print(f"  Error tm_id={tm_id}: {e}")

conn.commit()

# Dismiss remaining low-confidence audio that will never be publishable
cur.execute("""
    UPDATE telegram_messages
    SET "processedAt" = NOW()
    WHERE "processedAt" IS NULL
      AND ("suggestedMetadata"->>'series_slug' IS NULL
           OR ("suggestedMetadata"->>'confidence')::float < 0.6)
""")
dismissed2 = cur.rowcount
conn.commit()

print(f"\n{'='*50}")
print(f"RESULTS:")
print(f"  Non-audio dismissed     : {dismissed}")
print(f"  Lessons published       : {published}")
print(f"  Low-confidence dismissed: {dismissed2}")
print(f"  Errors                  : {failed}")

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
print(f"\nTotal published lessons: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM telegram_messages WHERE \"processedAt\" IS NULL")
print(f"Remaining in inbox: {cur.fetchone()[0]}")

cur.close()
conn.close()
db.close()
print("\nDone — admin inbox is now clean!")
