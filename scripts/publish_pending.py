"""
Re-process all pending TelegramMessages through the updated parser
and auto-publish any that now meet the confidence threshold.

Usage: py scripts/publish_pending.py
"""
import sys, os, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import psycopg2
from _neon import connect

# Import our parser and publisher
from telegram.importer.parser import parse_caption
from telegram.importer.publisher import auto_publish_message, MIN_CONFIDENCE

conn = connect()
cur = conn.cursor()

# Get all pending messages from the real channel
cur.execute("""
    SELECT id, "messageId", caption, date, "audioFilename", "suggestedMetadata"
    FROM telegram_messages
    WHERE "chatId" = '1747155048' AND "processedAt" IS NULL
    ORDER BY date ASC
""")
rows = cur.fetchall()
print(f"Pending messages to re-process: {len(rows)}")

# Import DB class
from telegram.importer.database import ImportDB

db_url = os.environ["DATABASE_URL"]
# strip channel_binding for psycopg2
if "channel_binding" in db_url:
    parts = db_url.split("?")
    base = parts[0]
    params = [p for p in parts[1].split("&") if not p.startswith("channel_binding")]
    db_url = base + "?" + "&".join(params)

db = ImportDB(db_url)

published = 0
skipped_conf = 0
skipped_no_series = 0
errors = 0

for row in rows:
    msg_id_db, msg_id_tg, caption, date, audio_filename, old_meta = row
    old_meta_dict = old_meta if isinstance(old_meta, dict) else json.loads(old_meta or "{}")

    try:
        # Re-parse with updated parser
        suggested = parse_caption(caption, audio_filename)

        if suggested.confidence < MIN_CONFIDENCE:
            skipped_conf += 1
            continue

        if not suggested.series_slug:
            skipped_no_series += 1
            continue

        # Try to auto-publish
        lesson_id = auto_publish_message(
            db=db,
            telegram_msg_id=msg_id_db,
            suggested=suggested.to_dict(),
            message_date=date,
            storage_key=old_meta_dict.get("mediaStorageKey"),
            audio_filename=audio_filename,
        )

        if lesson_id:
            published += 1
            if published % 50 == 0:
                print(f"  Published {published} lessons so far...")
        else:
            skipped_no_series += 1

    except Exception as e:
        print(f"  Error on msgId={msg_id_tg}: {e}")
        errors += 1

db.close()

print(f"\n{'='*50}")
print(f"  Published   : {published}")
print(f"  Low conf    : {skipped_conf}")
print(f"  No series   : {skipped_no_series}")
print(f"  Errors      : {errors}")
print(f"{'='*50}")
print(f"\n✓ Done! Open the site to see new lessons.")
print(f"  https://shaykh-muhammad-zain-library.vercel.app/en")
