# -*- coding: utf-8 -*-
"""Find Riyad as-Salihin messages and surrounding content."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Look at all messages in the range of the two known Riyad lessons
cur.execute("""
    SELECT tm."messageId", tm."audioFilename", tm."caption"
    FROM telegram_messages tm
    WHERE tm."chatId" = '1747155048'
      AND tm."audioFilename" IS NOT NULL
      AND tm."messageId" BETWEEN 3200 AND 3340
    ORDER BY tm."messageId"
""")
rows = cur.fetchall()
print("Messages 3200-3340 range (where lessons 307/308 are):")
for r in rows:
    print(f"  msgId={r[0]:5d}  file={str(r[1])[:70]}")

print()

# What about messages BEFORE the known Riyad lessons?
# Lesson 307 is at msgId 3319 — lessons 1-306 should be earlier
# They might not be in the DB at all if we never imported them
cur.execute("""
    SELECT MIN("messageId"), MAX("messageId"), COUNT(*)
    FROM telegram_messages
    WHERE "chatId" = '1747155048'
""")
r = cur.fetchone()
print(f"TG messages in DB: {r[2]} total, msgId range {r[0]} to {r[1]}")

# Check if there are messages < 3319 that match رياض
cur.execute("""
    SELECT tm."messageId", tm."audioFilename"
    FROM telegram_messages tm
    WHERE tm."chatId" = '1747155048'
      AND (
        tm."audioFilename" ILIKE '%رياض%'
        OR tm."audioFilename" ILIKE '%ريا%'
        OR tm."caption" ILIKE '%رياض الصالحين%'
      )
    ORDER BY tm."messageId"
""")
rows2 = cur.fetchall()
print(f"\nAll TG messages with رياض in filename or caption: {len(rows2)}")
for r in rows2:
    print(f"  msgId={r[0]:5d}  file={str(r[1])[:70]}")

# Check what the biggest msgId ranges are in unlinked messages
print("\n\nUnlinked message count by msgId range (100s):")
cur.execute("""
    SELECT (tm."messageId" / 100) * 100 AS range_start, COUNT(*) AS cnt
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE tm."chatId" = '1747155048'
      AND tm."audioFilename" IS NOT NULL
      AND l.id IS NULL
    GROUP BY range_start
    ORDER BY range_start
""")
for r in cur.fetchall():
    print(f"  msgId {r[0]:5d}-{r[0]+99}: {r[1]:3d} unlinked")

cur.close()
conn.close()
