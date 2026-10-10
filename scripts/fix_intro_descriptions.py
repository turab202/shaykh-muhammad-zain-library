# -*- coding: utf-8 -*-
"""Fix intro descriptions for early Tafsir lessons."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Lessons 1-6 are introduction lessons — give them proper Arabic description
# \u0645\u0642\u062f\u0645\u0629 \u0641\u064a \u0627\u0644\u062a\u0641\u0633\u064a\u0631 = مقدمة في التفسير
intro_desc = "\u0645\u0642\u062f\u0645\u0629 \u0641\u064a \u0627\u0644\u062a\u0641\u0633\u064a\u0631"

cur.execute("""
    UPDATE lessons SET description=%s
    WHERE id IN (
        SELECT l.id FROM lessons l
        JOIN series s ON l."seriesId"=s.id
        WHERE s.slug='tafsir-al-saadi'
          AND l."lessonNumber" <= 6
          AND l.status='PUBLISHED'
          AND l.description='تفسير السعدي'
    )
""", (intro_desc,))
print(f"Updated intro lessons: {cur.rowcount}")

# Also check lesson 21 (the announcement post) — set it as an intro too
cur.execute("""
    UPDATE lessons SET description=%s
    WHERE slug='tafsir-al-saadi-0021-CxbVPf'
      AND (description IS NULL OR description='')
""", ("\u0625\u0639\u0644\u0627\u0646 \u0628\u062f\u0621 \u0627\u0644\u062a\u0641\u0633\u064a\u0631",))  # إعلان بدء التفسير
print(f"Updated announcement: {cur.rowcount}")

conn.commit()

# Show final state
cur.execute("""
    SELECT l."lessonNumber", l.description
    FROM lessons l JOIN series s ON l."seriesId"=s.id
    WHERE s.slug='tafsir-al-saadi' AND l.status='PUBLISHED'
    ORDER BY l."publishedAt", l."lessonNumber"
    LIMIT 15
""")
print("\nFirst 15 Tafsir lessons:")
for r in cur.fetchall():
    print(f"  #{r[0]:>3}  {str(r[1] or '(none)')[:60]}")

conn.close()
