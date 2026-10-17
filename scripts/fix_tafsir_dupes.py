# -*- coding: utf-8 -*-
"""
Fix the tafsir-al-saadi duplicate lesson issue.

The series has TWO upload batches:
1. "تفسير_السعدي_" format: lessons 001-253 (the main numbered sequence)
2. "تفسير_سورة_" format: per-surah numbered 01-18 (a secondary batch, incomplete)

These two sets overlap in lesson numbers and represent different recordings.
Strategy: keep the main numbered set (001+) as the primary lessons,
and set the per-surah set (تفسير_سورة_) to DRAFT to hide duplicates.
Users can still access them via the admin panel.

We also fix other series that have similar two-batch duplicate issues.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# ── tafsir-al-saadi ──────────────────────────────────────────────────────────
# Hide the تفسير_سورة_ batch (keep تفسير_السعدي_ batch as primary)
cur.execute("""
    SELECT id, "lessonNumber"
    FROM lessons
    WHERE "seriesId" = (SELECT id FROM series WHERE slug='tafsir-al-saadi')
      AND status = 'PUBLISHED'
      AND "telegramSourceId" IN (
          SELECT id FROM telegram_messages
          WHERE "audioFilename" LIKE '%تفسير_سورة%'
             OR "audioFilename" LIKE '%تفسير سورة%'
      )
""")
to_draft = cur.fetchall()
print(f"tafsir-al-saadi: setting {len(to_draft)} 'تفسير_سورة_' lessons to DRAFT")
if to_draft:
    ids = [r[0] for r in to_draft]
    cur.execute("""
        UPDATE lessons SET status='DRAFT', "updatedAt"=NOW()
        WHERE id = ANY(%s)
    """, (ids,))
    conn.commit()

# ── Fix wasaya-luqman duplicates ─────────────────────────────────────────────
# The per-surah tafsir lessons had the same pattern applied to wasaya-luqman
# They are real, non-duplicate. Just need unique lesson numbers.
# Already handled by fix_bad_descriptions.py renumbering.

# ── Verify remaining duplicates ──────────────────────────────────────────────
cur.execute("""
    SELECT s.slug, COUNT(*) as dupe_groups
    FROM (
        SELECT l."seriesId", l."lessonNumber", COUNT(*) as cnt
        FROM lessons l
        WHERE l.status='PUBLISHED' AND l."lessonNumber" IS NOT NULL
        GROUP BY l."seriesId", l."lessonNumber"
        HAVING COUNT(*) > 1
    ) dupes
    JOIN series s ON s.id = dupes."seriesId"
    GROUP BY s.slug
    ORDER BY dupe_groups DESC
""")
remaining = cur.fetchall()
if remaining:
    print("\nRemaining duplicate lesson numbers (PUBLISHED):")
    for r in remaining:
        print(f"  {r[0]}: {r[1]} duplicate groups")
else:
    print("\nNo more duplicate lesson numbers.")

# ── Final counts ─────────────────────────────────────────────────────────────
cur.execute("""
    SELECT s.slug, COUNT(l.id) as published
    FROM series s
    LEFT JOIN lessons l ON l."seriesId"=s.id AND l.status='PUBLISHED'
    GROUP BY s.slug
    ORDER BY published DESC
    LIMIT 10
""")
print("\nTop 10 series by published lesson count:")
for r in cur.fetchall():
    print(f"  {r[0]:40s} {r[1]}")

cur.close()
conn.close()
print("\nDone.")
