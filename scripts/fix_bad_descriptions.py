# -*- coding: utf-8 -*-
"""
Fix specific bad descriptions that are just fragments of series names.
These provide no useful information and should be cleared (set to NULL)
so the UI falls back to the lesson title "Series — Lesson N".

Also fix duplicate lesson numbers within a series.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# ── 1. Clear useless fragment descriptions ───────────────────────────────────
# These phrases appear as description but give no information to the user.
BAD_DESCRIPTIONS = [
    'من أدلة الأحكام',
    'أدلة الأحكام',
    'على ألفية ابن مالك',
    'ألفية ابن مالك',
    'كتاب التوحيد',        # too generic for al-qawl context
    'على متممة الجرومية',
    'متممة الجرومية',
    'المقدمة الجرومية',
]

for bad_phrase in BAD_DESCRIPTIONS:
    cur.execute("""
        UPDATE lessons
        SET description = NULL, "updatedAt" = NOW()
        WHERE status = 'PUBLISHED'
          AND description = %s
    """, (bad_phrase,))
    if cur.rowcount:
        print(f"Cleared {cur.rowcount} lessons with description='{bad_phrase}'")

conn.commit()

# ── 2. Fix duplicate lesson numbers within a series ──────────────────────────
# Find series with duplicate lesson numbers
cur.execute("""
    SELECT "seriesId", "lessonNumber", COUNT(*) as cnt
    FROM lessons
    WHERE status = 'PUBLISHED'
      AND "lessonNumber" IS NOT NULL
    GROUP BY "seriesId", "lessonNumber"
    HAVING COUNT(*) > 1
""")
dupes = cur.fetchall()
print(f"\nFound {len(dupes)} duplicate lesson numbers across series")

for series_id, lesson_num, count in dupes:
    # Get all lessons with this duplicate number
    cur.execute("""
        SELECT l.id, l.slug, l."publishedAt", l."createdAt", tm."audioFilename"
        FROM lessons l
        LEFT JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
        WHERE l."seriesId" = %s AND l."lessonNumber" = %s AND l.status = 'PUBLISHED'
        ORDER BY l."publishedAt" NULLS LAST, l."createdAt"
    """, (series_id, lesson_num))
    rows = cur.fetchall()

    # Keep the first, renumber subsequent ones
    for i, (lid, slug, pub_at, created_at, filename) in enumerate(rows):
        if i == 0:
            continue  # keep first

        # Find the highest current lesson number in this series
        cur.execute("""
            SELECT COALESCE(MAX("lessonNumber"), 0)
            FROM lessons
            WHERE "seriesId" = %s AND status = 'PUBLISHED'
        """, (series_id,))
        max_num = cur.fetchone()[0]
        new_num = max_num + 1

        # Generate a new unique slug
        new_slug = f"{slug}-dup{i}"

        cur.execute("""
            UPDATE lessons
            SET "lessonNumber" = %s, slug = %s, "updatedAt" = NOW()
            WHERE id = %s
        """, (new_num, new_slug, lid))
        print(f"  Renumbered duplicate #{lesson_num} → #{new_num} (lesson {lid[:12]}...)")

conn.commit()

# ── 3. Summary ───────────────────────────────────────────────────────────────
cur.execute("""
    SELECT COUNT(*) FROM lessons
    WHERE status='PUBLISHED' AND description IS NOT NULL AND description != ''
""")
with_desc = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
total = cur.fetchone()[0]
print(f"\nLessons with description: {with_desc}/{total} ({with_desc*100//total}%)")

# Verify no more duplicates
cur.execute("""
    SELECT COUNT(*) FROM (
        SELECT "seriesId", "lessonNumber", COUNT(*) as cnt
        FROM lessons WHERE status='PUBLISHED' AND "lessonNumber" IS NOT NULL
        GROUP BY "seriesId", "lessonNumber" HAVING COUNT(*) > 1
    ) x
""")
remaining_dupes = cur.fetchone()[0]
print(f"Remaining duplicate lesson numbers: {remaining_dupes}")

cur.close()
conn.close()
print("\nDone.")
