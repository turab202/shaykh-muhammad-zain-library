"""Check Al-Qawl al-Mufid lessons audio status."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

cur.execute("""
    SELECT l."lessonNumber", l.slug, l.duration, l.status,
           ts."messageId", ts."audioFilename",
           m."storageKey", m.size
    FROM lessons l
    JOIN series s ON l."seriesId" = s.id AND s.slug = 'al-qawl-al-mufid'
    LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    ORDER BY l."lessonNumber"
""")
rows = cur.fetchall()
print(f"Al-Qawl al-Mufid lessons: {len(rows)}")
for r in rows:
    num, slug, dur, status, msg_id, filename, key, size = r
    audio = f"B2: {str(key)[:40]}" if key else f"TG msgId={msg_id}" if msg_id else "NO AUDIO"
    print(f"  #{num:>2} dur={dur}s  {audio}")
    if filename:
        print(f"       file: {filename[:50]}")

cur.close()
conn.close()
