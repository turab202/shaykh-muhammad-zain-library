# -*- coding: utf-8 -*-
"""Check the distribution of remaining audio downloads by message ID range."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur  = conn.cursor()

cur.execute("""
    SELECT MIN(ts."messageId"), MAX(ts."messageId"), COUNT(*)
    FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE l.status = 'PUBLISHED' AND m.id IS NULL
      AND ts."audioFilename" IS NOT NULL
""")
r = cur.fetchone()
print(f"Remaining: {r[2]} lessons  (msgId {r[0]} to {r[1]})")
print()

cur.execute("""
    SELECT ts."messageId" / 100 * 100 AS range_start, COUNT(*) AS cnt
    FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE l.status = 'PUBLISHED' AND m.id IS NULL
      AND ts."audioFilename" IS NOT NULL
    GROUP BY ts."messageId" / 100 * 100
    ORDER BY range_start DESC
    LIMIT 20
""")
print("Range           | Lessons needing audio")
print("-" * 40)
total = 0
for r in cur.fetchall():
    print(f"  msgId {r[0]:>4}-{r[0]+99:<4}  |  {r[1]:>3}")
    total += r[1]
print(f"\nTotal: {total}")

cur.close()
conn.close()
