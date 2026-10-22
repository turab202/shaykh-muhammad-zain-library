import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

cur.execute("SELECT COUNT(DISTINCT \"audioFilename\") FROM telegram_messages WHERE \"audioFilename\" IS NOT NULL AND lower(\"audioFilename\") LIKE '%.mp3'")
unique_mp3 = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM telegram_messages WHERE \"audioFilename\" IS NOT NULL AND lower(\"audioFilename\") LIKE '%.mp3'")
total_mp3 = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND \"telegramSourceId\" IS NOT NULL")
lessons_with_tg = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
total_lessons = cur.fetchone()[0]

print(f"Unique MP3 filenames in DB  : {unique_mp3}")
print(f"Total MP3 TG messages in DB : {total_mp3}")
print(f"Published lessons with TG   : {lessons_with_tg}")
print(f"Total published lessons     : {total_lessons}")
print(f"Telegram channel shows      : 2323 audio files")
print()
print("Note: 3860 lessons > 2323 TG files because:")
print("  - Multiple lessons per series were published from different TG message IDs")
print("  - Some lessons were manually created or duplicated in previous bulk imports")

# Find duplicate TG messages (same messageId linked to multiple lessons)
cur.execute("""
    SELECT tm."messageId", COUNT(l.id) as lesson_count
    FROM telegram_messages tm
    JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE l.status = 'PUBLISHED'
    GROUP BY tm."messageId"
    HAVING COUNT(l.id) > 1
    ORDER BY lesson_count DESC
    LIMIT 10
""")
dupes = cur.fetchall()
if dupes:
    print(f"\nTG messages linked to multiple lessons ({len(dupes)} found):")
    for r in dupes:
        print(f"  msgId={r[0]}: {r[1]} lessons")

cur.close(); conn.close()
