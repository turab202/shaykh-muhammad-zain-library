# -*- coding: utf-8 -*-
"""Fix any remaining duplicate lesson numbers by renumbering later entries."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

cur.execute("""
    SELECT "seriesId", "lessonNumber", array_agg(id ORDER BY "createdAt") as ids
    FROM lessons
    WHERE status='PUBLISHED' AND "lessonNumber" IS NOT NULL
    GROUP BY "seriesId", "lessonNumber"
    HAVING COUNT(*) > 1
""")
dupes = cur.fetchall()
print(f"Found {len(dupes)} duplicate lesson numbers")

for series_id, lesson_num, ids in dupes:
    # Keep the first (oldest), renumber the rest
    for i, lesson_id in enumerate(ids[1:], 1):
        cur.execute("SELECT COALESCE(MAX(\"lessonNumber\"), 0) FROM lessons WHERE \"seriesId\"=%s AND status='PUBLISHED'", (series_id,))
        max_num = cur.fetchone()[0]
        new_num = max_num + 1
        cur.execute("UPDATE lessons SET \"lessonNumber\"=%s, \"updatedAt\"=NOW() WHERE id=%s", (new_num, lesson_id))
        print(f"  #{lesson_num} → #{new_num}")

conn.commit()

# Final verification
cur.execute("""
    SELECT COUNT(*) FROM (
        SELECT "seriesId", "lessonNumber" FROM lessons
        WHERE status='PUBLISHED' AND "lessonNumber" IS NOT NULL
        GROUP BY "seriesId", "lessonNumber" HAVING COUNT(*)>1
    ) x
""")
print(f"Remaining duplicates: {cur.fetchone()[0]}")

cur.close(); conn.close()
print("Done.")
