# -*- coding: utf-8 -*-
"""
Find and remove duplicate lessons — multiple lessons pointing to the same TG message.
Keep the OLDEST lesson (first created), delete the rest.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Find all TG messages that have more than 1 lesson
cur.execute("""
    SELECT tm."messageId", array_agg(l.id ORDER BY l."createdAt") as lesson_ids,
           array_agg(l."lessonNumber" ORDER BY l."createdAt") as lesson_nums,
           array_agg(s.slug ORDER BY l."createdAt") as series_slugs
    FROM telegram_messages tm
    JOIN lessons l ON l."telegramSourceId" = tm.id
    JOIN series s ON s.id = l."seriesId"
    WHERE l.status = 'PUBLISHED'
    GROUP BY tm."messageId"
    HAVING COUNT(l.id) > 1
""")
dupes = cur.fetchall()
print(f"TG messages with multiple lessons: {len(dupes)}")

ids_to_delete = []
for msg_id, lesson_ids, lesson_nums, series_slugs in dupes:
    # Keep first (oldest), delete the rest
    keep = lesson_ids[0]
    delete = lesson_ids[1:]
    ids_to_delete.extend(delete)

print(f"Duplicate lessons to delete: {len(ids_to_delete)}")

if ids_to_delete:
    # First delete any media records for these lessons
    cur.execute("DELETE FROM media WHERE \"lessonId\" = ANY(%s)", (ids_to_delete,))
    media_deleted = cur.rowcount
    
    # Then delete the lessons
    cur.execute("DELETE FROM lessons WHERE id = ANY(%s)", (ids_to_delete,))
    lessons_deleted = cur.rowcount
    
    conn.commit()
    print(f"Deleted {media_deleted} media records")
    print(f"Deleted {lessons_deleted} duplicate lessons")

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
total = cur.fetchone()[0]
print(f"\nPublished lessons after cleanup: {total}")
print(f"Telegram audio files: 2323")
print(f"Difference: {total - 2323} (these are extra TG messages beyond what channel shows,")
print(f"  e.g. re-uploads of same content with different message IDs)")

cur.close(); conn.close()
print("\nDone.")
