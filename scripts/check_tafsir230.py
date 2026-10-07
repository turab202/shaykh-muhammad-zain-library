"""Quick check of lesson 230 duration and media storageKey."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

cur.execute("""
    SELECT l.id, l.slug, l.title, l.duration, l."lessonNumber", l.status,
           l."telegramSourceId",
           ts."messageId",
           m.id as media_id, m."storageKey", m."mediaType", m.size
    FROM lessons l
    LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id
    WHERE ts."messageId" = 3333
""")
rows = cur.fetchall()
for r in rows:
    print(f"lesson id    : {r[0]}")
    print(f"slug         : {r[1]}")
    print(f"title        : {r[2]}")
    print(f"duration     : {r[3]}s  ← THIS MUST BE > 0 FOR PLAYER TO SHOW TIME")
    print(f"lessonNumber : {r[4]}, status={r[5]}")
    print(f"tg source id : {r[6]}")
    print(f"tg messageId : {r[7]}")
    print(f"media id     : {r[8]}")
    print(f"storageKey   : {r[9]}")
    print(f"mediaType    : {r[10]}, size={r[11]} bytes")

cur.close()
conn.close()
