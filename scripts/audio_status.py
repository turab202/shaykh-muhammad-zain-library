"""Quick audio import status check."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Messages in DB range
cur.execute('SELECT MIN("messageId"), MAX("messageId"), COUNT(*) FROM telegram_messages')
r = cur.fetchone()
print(f"Messages in DB : {r[2]:,} (IDs {r[0]} to {r[1]})")

# Published lessons
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
print(f"Published      : {cur.fetchone()[0]:,}")

# With B2 audio
cur.execute("""
    SELECT COUNT(DISTINCT l.id) FROM lessons l
    JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED'
""")
with_audio = cur.fetchone()[0]
print(f"With B2 audio  : {with_audio:,}")

# Still need audio
cur.execute("""
    SELECT COUNT(DISTINCT l.id) FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId"=ts.id
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
      AND ts."audioFilename" IS NOT NULL
""")
need = cur.fetchone()[0]
print(f"Need download  : {need:,}")

# Lowest undownloaded message ID
cur.execute("""
    SELECT MIN(ts."messageId") FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId"=ts.id
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
      AND ts."audioFilename" IS NOT NULL
""")
r = cur.fetchone()
print(f"Oldest undownl : msgId={r[0]}")

# Channel coverage — what's lowest message ID in DB
cur.execute('SELECT MIN("messageId") FROM telegram_messages')
lowest = cur.fetchone()[0]
print(f"Lowest msg in DB: {lowest}")
if lowest and lowest > 1:
    print(f"  → {lowest-1} messages NOT YET in DB (need --no-media pass to reach them)")

cur.close()
conn.close()
