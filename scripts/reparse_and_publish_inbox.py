# -*- coding: utf-8 -*-
"""
Re-parse all pending inbox messages with the UPDATED parser (which now
knows about all 33 series), then auto-publish the ones that match.

This fixes the 1736 messages stuck in the inbox because the parser
at import time didn't know about the new series.
"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from _neon import connect

# Use the updated parser
from telegram.importer.parser import parse_caption
from telegram.importer.publisher import auto_publish_message, MIN_CONFIDENCE
from telegram.importer.database import ImportDB
import os
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

conn = connect()
cur = conn.cursor()

# Get all pending messages with audio
cur.execute("""
    SELECT id, "messageId", "audioFilename", caption, date, 
           "suggestedMetadata", "chatId"
    FROM telegram_messages
    WHERE "processedAt" IS NULL
      AND "audioFilename" IS NOT NULL
      AND lower("audioFilename") NOT LIKE '%.pdf'
      AND lower("audioFilename") NOT LIKE '%.webp'
      AND lower("audioFilename") NOT LIKE '%.apk'
    ORDER BY "messageId"
""")
rows = cur.fetchall()
print(f"Pending messages with audio: {len(rows)}")

# Re-parse each with updated parser
updated = 0
publishable = 0

updates = []
for tm_id, msg_id, audio_fn, caption, date, old_meta, chat_id in rows:
    # Re-run the parser with the updated KNOWN_SERIES
    new_meta = parse_caption(caption, audio_fn)
    
    if new_meta.series_slug and new_meta.confidence >= MIN_CONFIDENCE:
        publishable += 1
    
    if new_meta.series_slug != (old_meta or {}).get('series_slug'):
        updates.append((json.dumps(new_meta.to_dict()), tm_id))
        updated += 1

print(f"Messages where series detection improved: {updated}")
print(f"Now publishable (conf>={MIN_CONFIDENCE}, has series): {publishable}")

# Bulk update suggestedMetadata
if updates:
    cur.executemany(
        'UPDATE telegram_messages SET "suggestedMetadata"=%s WHERE id=%s',
        updates
    )
    conn.commit()
    print(f"Updated {len(updates)} suggestedMetadata records")

# Now auto-publish all that qualify
print(f"\nAuto-publishing {publishable} messages...")

# Reload from DB (fresh data after update)
cur.execute("""
    SELECT id, "messageId", "audioFilename", "suggestedMetadata", "chatId"
    FROM telegram_messages
    WHERE "processedAt" IS NULL
      AND "audioFilename" IS NOT NULL
      AND lower("audioFilename") NOT LIKE '%.pdf'
      AND lower("audioFilename") NOT LIKE '%.webp'
    ORDER BY "messageId"
""")
pending = cur.fetchall()

published = 0
skipped_low_conf = 0
skipped_no_series = 0
errors = 0

db = ImportDB(os.environ["DATABASE_URL"])

for tm_id, msg_id, audio_fn, meta, chat_id in pending:
    meta_dict = meta if isinstance(meta, dict) else {}
    conf = float(meta_dict.get('confidence', 0))
    series = meta_dict.get('series_slug')
    
    if not series:
        skipped_no_series += 1
        # Mark as processed anyway (no series = never publishable)
        cur.execute(
            'UPDATE telegram_messages SET "processedAt"=NOW() WHERE id=%s',
            (tm_id,)
        )
        continue
    
    if conf < MIN_CONFIDENCE:
        skipped_low_conf += 1
        continue
    
    try:
        lesson_id = auto_publish_message(
            db=db,
            telegram_msg_id=tm_id,
            suggested=meta_dict,
            audio_storage_key=None,
            audio_duration_seconds=0,
        )
        if lesson_id:
            # Mark as processed
            cur.execute(
                'UPDATE telegram_messages SET "processedAt"=NOW() WHERE id=%s',
                (tm_id,)
            )
            published += 1
            if published % 50 == 0:
                conn.commit()
                print(f"  Published {published}...", flush=True)
        else:
            skipped_low_conf += 1
    except Exception as e:
        errors += 1
        if errors <= 5:
            print(f"  Error msgId={msg_id}: {e}")

conn.commit()

print(f"\nResults:")
print(f"  Published     : {published}")
print(f"  Skipped (low confidence): {skipped_low_conf}")
print(f"  Skipped (no series found): {skipped_no_series}")
print(f"  Errors        : {errors}")

# Final counts
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM telegram_messages WHERE \"processedAt\" IS NULL")
remaining = cur.fetchone()[0]
print(f"\nPublished lessons now: {total}")
print(f"Still pending in inbox: {remaining}")

cur.close()
conn.close()
db.close()
print("\nDone.")
