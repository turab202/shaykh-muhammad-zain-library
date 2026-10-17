# -*- coding: utf-8 -*-
"""
Final DB cleanup:
1. Delete empty DRAFT placeholder lessons (no TG source, no audio)
2. Fix lesson numbering for series where numbers got pushed to 231+ by dedup
3. Verify final state
"""
import sys, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# ── 1. Delete placeholder DRAFT lessons with no TG source ───────────────────
cur.execute("""
    SELECT id, title, "lessonNumber", "seriesId"
    FROM lessons
    WHERE status = 'DRAFT'
      AND "telegramSourceId" IS NULL
      AND id NOT IN (
          SELECT "lessonId" FROM media WHERE "lessonId" IS NOT NULL
      )
""")
placeholders = cur.fetchall()
print(f"DRAFT placeholder lessons to delete: {len(placeholders)}")
for r in placeholders:
    print(f"  #{r[2]} '{r[1][:50]}'")

if placeholders:
    ids = [r[0] for r in placeholders]
    cur.execute("DELETE FROM lessons WHERE id = ANY(%s)", (ids,))
    print(f"  Deleted {cur.rowcount}")
    conn.commit()

# ── 2. Fix renumbered duplicates that got pushed to 231–400 range ────────────
# These happen in series where the SAME lesson number appeared for lessons
# from different surahs/chapters. The dedup script pushed them to high numbers.
# Better: renumber each series sequentially by messageId order.

# Find series where max lesson number > expected (suggests renumbering artifacts)
cur.execute("""
    SELECT s.slug, s.id,
           COUNT(l.id) as total,
           MAX(l."lessonNumber") as max_num
    FROM series s
    JOIN lessons l ON l."seriesId" = s.id AND l.status = 'PUBLISHED'
    WHERE l."lessonNumber" IS NOT NULL
    GROUP BY s.id, s.slug
    HAVING MAX(l."lessonNumber") > COUNT(l.id) * 2  -- gap indicates renaming
    ORDER BY s.slug
""")
gapped_series = cur.fetchall()
print(f"\nSeries with numbering gaps: {len(gapped_series)}")
for r in gapped_series:
    print(f"  {r[0]}: {r[2]} lessons, max_num={r[3]}")

# For each gapped series, renumber sequentially by messageId
for slug, series_id, total, max_num in gapped_series:
    cur.execute("""
        SELECT l.id, tm."messageId", l."lessonNumber"
        FROM lessons l
        LEFT JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
        WHERE l."seriesId" = %s AND l.status = 'PUBLISHED'
        ORDER BY tm."messageId" NULLS LAST, l."lessonNumber"
    """, (series_id,))
    lessons = cur.fetchall()

    updates = []
    for new_num, (lid, msg_id, old_num) in enumerate(lessons, 1):
        if old_num != new_num:
            updates.append((new_num, lid))

    if updates:
        cur.executemany(
            'UPDATE lessons SET "lessonNumber"=%s, "updatedAt"=NOW() WHERE id=%s',
            updates
        )
        print(f"  Renumbered {len(updates)} lessons in {slug}")

conn.commit()

# ── 3. Fix lesson slugs that got mangled ──────────────────────────────────────
# Some slugs look like "bulugh-al-maram-0295-dup1" — clean them up
cur.execute("""
    SELECT id, slug, "seriesId", "lessonNumber"
    FROM lessons
    WHERE slug LIKE '%-dup%'
    AND status = 'PUBLISHED'
""")
dup_slugs = cur.fetchall()
print(f"\nLessons with '-dup' in slug: {len(dup_slugs)}")

for lid, slug, series_id, lesson_num in dup_slugs:
    # Rebuild clean slug
    clean = re.sub(r'-dup\d+$', '', slug)
    # Make unique with lesson number
    new_slug = f"{clean}-{lesson_num:04d}" if lesson_num else clean
    cur.execute("UPDATE lessons SET slug=%s WHERE id=%s", (new_slug, lid))

if dup_slugs:
    conn.commit()
    print(f"  Fixed {len(dup_slugs)} slugs")

# ── 4. Final summary ──────────────────────────────────────────────────────────
print("\n" + "="*55)
print("FINAL STATE:")
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
print(f"Published lessons: {cur.fetchone()[0]}")

cur.execute("""
    SELECT s.slug, COUNT(l.id) as total, MAX(l."lessonNumber") as max_num
    FROM series s JOIN lessons l ON l."seriesId"=s.id AND l.status='PUBLISHED'
    GROUP BY s.slug ORDER BY total DESC LIMIT 10
""")
print("\nTop 10 series:")
for r in cur.fetchall():
    print(f"  {r[0]:40s} {r[1]:4d} lessons  max#={r[2]}")

cur.close()
conn.close()
print("\nDone.")
