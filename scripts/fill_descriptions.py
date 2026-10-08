"""
Parse Telegram captions to extract surah/ayah/topic info and
fill lesson descriptions where currently empty.

Patterns found in captions:
- سورة إبراهيم ٢٤ - ٣٤   (surah + ayah range)
- باب ... (chapter/topic)
- ك. التوحيد (book section)

Also parses audioFilename for Bulugh al-Maram style:
  037-بلوغ المرام من أدلة الأحكام.mp3  → no extra info in filename

For Tafsir: caption contains (سورة ... آية/ة ...) pattern
"""
import re, sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

# Arabic-Indic digit map
ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

def normalise(text: str) -> str:
    return text.translate(ARABIC_DIGITS)

def extract_surah_ayah(caption: str) -> str | None:
    """Extract surah + ayah range from Arabic caption text."""
    if not caption:
        return None
    # Strip markdown and parentheses before matching
    clean = re.sub(r'[*_`()\[\]]', '', caption)

    # Pattern: سورة XYZ \d+ - \d+  (with Arabic-Indic or Western digits)
    m = re.search(
        r'سورة\s+([^\n\d٠-٩]+?)\s+([\d٠-٩]+)\s*[-–]\s*([\d٠-٩]+)',
        clean
    )
    if m:
        surah = m.group(1).strip().strip('من').strip()
        start = normalise(m.group(2))
        end   = normalise(m.group(3))
        return f"سورة {surah} — الآية {start}–{end}"

    # Pattern: سورة XYZ الآية \d+
    m = re.search(r'سورة\s+([^\n\d٠-٩]+?)\s+(?:الآية|آية)\s+([\d٠-٩]+)', clean)
    if m:
        surah = m.group(1).strip().strip('من').strip()
        ayah  = normalise(m.group(2))
        return f"سورة {surah} — الآية {ayah}"

    # Pattern: just سورة XYZ
    m = re.search(r'سورة\s+([^\n\d٠-٩\(\)]{3,30})', clean)
    if m:
        return f"سورة {m.group(1).strip().strip('من').strip()}"

    return None


def extract_chapter(caption: str) -> str | None:
    """Extract باب/chapter topic from caption."""
    if not caption:
        return None
    m = re.search(r'باب\s+(.{5,60}?)(?:\n|$)', caption)
    if m:
        return f"باب {m.group(1).strip()}"
    return None


conn = connect()
cur = conn.cursor()

# Get all published lessons that have a description (re-run to fix partial ones)
# AND ones that have no description
cur.execute("""
    SELECT l.id, l.slug, l.title, ts."caption", ts."audioFilename",
           l."seriesId",
           s.slug AS series_slug
    FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    JOIN series s ON l."seriesId" = s.id
    WHERE l.status = 'PUBLISHED'
      AND ts."caption" IS NOT NULL
    ORDER BY s.slug, l."lessonNumber"
""")
rows = cur.fetchall()
print(f"Lessons without description: {len(rows)}")

updated = 0
for lesson_id, slug, title, caption, filename, series_id, series_slug in rows:
    desc = None

    if 'tafsir' in series_slug:
        desc = extract_surah_ayah(caption)

    if not desc:
        desc = extract_chapter(caption)

    # For Bulugh al-Maram: try to get topic from filename
    # e.g. "037-بلوغ المرام من أدلة الأحكام.mp3" — no extra info, skip

    if desc:
        cur.execute(
            "UPDATE lessons SET description=%s WHERE id=%s",
            (desc, lesson_id)
        )
        updated += 1
        if updated <= 10 or updated % 50 == 0:
            print(f"  [{updated}] {slug[:45]:45s} => {desc[:60]}")

conn.commit()
print(f"\nUpdated {updated} lesson descriptions.")
conn.close()
