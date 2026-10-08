# -*- coding: utf-8 -*-
"""
Parse Telegram captions to extract surah/ayah/topic info
and fill lesson descriptions.
"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

# Arabic-Indic digits U+0660..U+0669
_AI_DIGIT_CLASS = "\u0660-\u0669"
# Digit pattern: Arabic-Indic OR Western ASCII digits
_DIGIT = f"[{_AI_DIGIT_CLASS}\\d]"
# Translation table: Arabic-Indic -> ASCII
_DIGIT_MAP = str.maketrans(
    "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669",
    "0123456789"
)

def _to_ascii(s: str) -> str:
    return s.translate(_DIGIT_MAP)

def extract_surah_ayah(caption: str) -> str | None:
    if not caption:
        return None

    # 1. Strip markdown punctuation, replace with spaces
    clean = re.sub(r'[*_`()\[\]]', ' ', caption)
    # 2. Collapse whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()

    # 3. Find سورة
    m = re.search(r'\u0633\u0648\u0631\u0629\s+(.+)', clean)  # سورة
    if not m:
        return None

    rest = m.group(1).strip()

    # 4. Remove leading noise like "من الآية" or "من"
    # \u0645\u0646 = من, \u0627\u0644\u0622\u064a\u0629 = الآية
    rest = re.sub(r'^\u0645\u0646\s+\u0627\u0644\u0622\u064a\u0629\s*', '', rest).strip()
    rest = re.sub(r'^\u0645\u0646\s+', '', rest).strip()

    # 5. Find first digit position
    digit_m = re.search(f'[{_AI_DIGIT_CLASS}\\d]', rest)

    if digit_m:
        pos = digit_m.start()
        surah_raw = rest[:pos].strip()
        # Remove trailing "من" / "الآية" noise
        surah_raw = re.sub(
            r'\s+(\u0645\u0646|\u0627\u0644\u0622\u064a\u0629|\u0622\u064a\u0629)\s*$',
            '', surah_raw
        ).strip()

        digits_part = rest[pos:]

        # Range: N - M
        rng = re.match(f'({_DIGIT}+)\\s*[-\u2013]\\s*({_DIGIT}+)', digits_part)
        if rng and surah_raw:
            start = _to_ascii(rng.group(1))
            end   = _to_ascii(rng.group(2))
            return f"\u0633\u0648\u0631\u0629 {surah_raw} \u2014 \u0627\u0644\u0622\u064a\u0629 {start}\u2013{end}"

        # Single ayah
        single = re.match(f'({_DIGIT}+)', digits_part)
        if single and surah_raw:
            ayah = _to_ascii(single.group(1))
            return f"\u0633\u0648\u0631\u0629 {surah_raw} \u2014 \u0627\u0644\u0622\u064a\u0629 {ayah}"

    # No digits — just the surah name, stop at newline or Ethiopic
    name = re.split(r'[\n\r\u1200-\u137f]', rest)[0].strip()
    name = re.sub(
        r'\s+(\u0645\u0646|\u0627\u0644\u0622\u064a\u0629)\s*$', '', name
    ).strip()
    if name and len(name) <= 40:
        return f"\u0633\u0648\u0631\u0629 {name}"

    return None


def extract_chapter(caption: str) -> str | None:
    if not caption:
        return None
    # \u0628\u0627\u0628 = باب
    m = re.search(r'\u0628\u0627\u0628\s+(.{5,60}?)(?:\n|$)', caption)
    if m:
        return f"\u0628\u0627\u0628 {m.group(1).strip()}"
    return None


conn = connect()
cur = conn.cursor()

cur.execute("""
    SELECT l.id, l.slug, ts."caption", s.slug AS series_slug
    FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    JOIN series s ON l."seriesId" = s.id
    WHERE l.status = 'PUBLISHED'
      AND ts."caption" IS NOT NULL
    ORDER BY s.slug, l."lessonNumber"
""")
rows = cur.fetchall()
print(f"Lessons to process: {len(rows)}")

updated = 0
for lesson_id, slug, caption, series_slug in rows:
    desc = None
    if 'tafsir' in series_slug:
        desc = extract_surah_ayah(caption)
    if not desc:
        desc = extract_chapter(caption)

    if desc:
        cur.execute("UPDATE lessons SET description=%s WHERE id=%s", (desc, lesson_id))
        updated += 1
        if updated <= 5 or updated % 100 == 0:
            # Print slug + first 40 chars of desc as ASCII-safe repr
            print(f"  [{updated}] {slug[:40]} => {desc[:50].encode('ascii','replace').decode()}")

conn.commit()
print(f"\nUpdated {updated} lesson descriptions.")
conn.close()
