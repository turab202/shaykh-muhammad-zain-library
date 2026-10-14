# -*- coding: utf-8 -*-
"""Show samples of unlinked TG messages to understand filename patterns."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Get all unlinked TG messages with audio, ordered by messageId
cur.execute("""
    SELECT tm."messageId", tm."audioFilename", tm."caption"
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE tm."chatId" = '1747155048'
      AND tm."audioFilename" IS NOT NULL
      AND l.id IS NULL
    ORDER BY tm."messageId"
""")
rows = cur.fetchall()
print(f"Total unlinked: {len(rows)}")
print()
print("First 60 unlinked messages (lowest msgIds — these are earliest content):")
for r in rows[:60]:
    caption = str(r[2])[:60] if r[2] else ''
    print(f"  msgId={r[0]:5d}  file={str(r[1])[:70]}  cap={caption}")

print()
print("Sample from middle range (msgId ~1000-2000):")
mid = [r for r in rows if 1000 <= r[0] <= 2000]
for r in mid[:20]:
    print(f"  msgId={r[0]:5d}  file={str(r[1])[:70]}")

print()
print("Unlinked messages with 'رياض' pattern search — any Arabic:")
for r in rows:
    fn = str(r[1]) if r[1] else ''
    if 'رياض' in fn or 'صالح' in fn or 'رياد' in fn:
        print(f"  msgId={r[0]:5d}  file={fn[:70]}")

cur.close()
conn.close()
