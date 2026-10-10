# -*- coding: utf-8 -*-
"""
Fill descriptions for Tafsir lessons that have no description by
parsing the audio filename when the caption is empty.
"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

# Arabic-Indic → ASCII
_DIGIT_MAP = str.maketrans(
    "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669",
    "0123456789"
)

def desc_from_filename(filename: str) -> str | None:
    """Extract a readable description from the audio filename."""
    if not filename:
        return None
    stem = Path(filename).stem

    # Pattern: تفسير_السعدي_سورة_X or سورة_X
    # e.g. 007_تفسير_السعديأصول_وكليات_التفسير_١_
    # Strip leading number and common series prefix
    cleaned = re.sub(r'^[\d_-]+', '', stem)
    # Remove series name prefix
    cleaned = re.sub(r'^تفسير_?السعدي_?', '', cleaned)
    cleaned = re.sub(r'^تفسير_?سورة_?', '\u0633\u0648\u0631\u0629 ', cleaned)

    # Replace underscores with spaces
    cleaned = cleaned.replace('_', ' ').strip()

    if not cleaned or len(cleaned) < 3:
        return None

    # Normalise Arabic-Indic digits
    cleaned = cleaned.translate(_DIGIT_MAP)

    # Remove trailing numbers that are just part 1/2/3 (not surah numbers)
    cleaned = re.sub(r'\s+\d+\s*$', '', cleaned).strip()

    return cleaned if cleaned else None


conn = connect()
cur = conn.cursor()

# Get all tafsir lessons still missing descriptions
cur.execute("""
    SELECT l.id, l."lessonNumber", l.slug, ts."audioFilename"
    FROM lessons l
    JOIN series s ON l."seriesId" = s.id
    LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    WHERE s.slug = 'tafsir-al-saadi'
      AND l.status = 'PUBLISHED'
      AND (l.description IS NULL OR l.description = '')
      AND ts."audioFilename" IS NOT NULL
    ORDER BY l."publishedAt", l."lessonNumber"
""")
rows = cur.fetchall()
print(f"Lessons to fill: {len(rows)}")

updated = 0
for lesson_id, num, slug, filename in rows:
    desc = desc_from_filename(filename)
    if desc:
        cur.execute("UPDATE lessons SET description=%s WHERE id=%s", (desc, lesson_id))
        updated += 1
        print(f"  #{num:>3} {filename[:50]} => {desc[:50]}")
    else:
        # For lessons 1-6 with generic filenames (001-تفسير السعدي.mp3)
        # Set a helpful description based on lesson number range
        lesson_num = num or 0
        if lesson_num <= 6:
            desc = "\u0645\u0642\u062f\u0645\u0629 \u0648\u062a\u0639\u0631\u064a\u0641 \u0628\u0627\u0644\u062a\u0641\u0633\u064a\u0631"  # مقدمة وتعريف بالتفسير
            cur.execute("UPDATE lessons SET description=%s WHERE id=%s", (desc, lesson_id))
            updated += 1
            print(f"  #{num:>3} (generic) => {desc}")

conn.commit()
print(f"\nUpdated {updated} descriptions.")
conn.close()
