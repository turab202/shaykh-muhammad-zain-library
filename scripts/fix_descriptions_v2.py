# -*- coding: utf-8 -*-
"""
Fix lesson descriptions/titles for ALL series.
Problems found:
- Bulugh al-Maram: "من أدلة الأحكام" (just series subtitle, not useful)
- Many lessons with repetitive or fragment descriptions
- Lessons where description == title (redundant)

Strategy: extract the most informative part from the TG audioFilename.
For Bulugh: "022-بلوغ_المرام_من_أدلة_الأحكام_21-كتاب_الطهارة_رقم_الحديث_١٠٥_١١٣.mp3"
  → description: "كتاب الطهارة — الحديث 105–113"

For Tafsir: "230_تفسير_السعدي_سورة_إبراهيم_الآية_٢٤_٣٤_.mp3"
  → description: "سورة إبراهيم — الآية 24–34"  ✓ (already good)
"""
import sys, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

_ARABIC_DIGITS = str.maketrans("١٢٣٤٥٦٧٨٩٠", "1234567890")

def normalize_nums(s: str) -> str:
    return s.translate(_ARABIC_DIGITS)


# ── Series-specific description extractors ──────────────────────────────────

def extract_bulugh(filename: str) -> str | None:
    """
    e.g. "022-بلوغ_المرام_من_أدلة_الأحكام_21-كتاب_الطهارة_رقم_الحديث_١٠٥_١١٣.mp3"
    Want: "كتاب الطهارة — الحديث 105–113"
    """
    fn = Path(filename).stem.replace('_', ' ')
    # Remove leading lesson number
    fn = re.sub(r'^\d+[-\s]+', '', fn).strip()
    # Remove "بلوغ المرام من أدلة الأحكام" prefix
    fn = re.sub(r'بلوغ المرام من أدلة الأحكام\s*', '', fn).strip()
    fn = re.sub(r'بلوغ المرام\s*', '', fn).strip()
    # Remove secondary number like "21-"
    fn = re.sub(r'^\d+[-\s]+', '', fn).strip()
    fn = normalize_nums(fn)
    # Rename "رقم الحديث X Y" → "الحديث X–Y"
    fn = re.sub(r'رقم الحديث\s+(\d+)\s+(\d+)', r'الحديث \1–\2', fn)
    fn = re.sub(r'رقم الحديث\s+(\d+)', r'الحديث \1', fn)
    fn = fn.strip('-_ ')
    return fn if len(fn) > 3 else None


def extract_sunan(filename: str, series_prefix: str) -> str | None:
    """
    e.g. "231_سنن_ابن_ماجه_كتاب_اللباس_رقم_الحديث_٣٦٣٧_٣٦٥٦_.mp3"
    Want: "كتاب اللباس — الحديث 3637–3656"
    """
    fn = Path(filename).stem.replace('_', ' ')
    fn = re.sub(r'^\d+[-\s]+', '', fn).strip()
    fn = re.sub(re.escape(series_prefix) + r'\s*', '', fn, flags=re.IGNORECASE).strip()
    # Remove chapter number like "08_" or "09_"
    fn = re.sub(r'^\d+[-\s]+', '', fn).strip()
    fn = normalize_nums(fn)
    fn = re.sub(r'رقم الحديث\s+(\d+)\s+(\d+)', r'الحديث \1–\2', fn)
    fn = re.sub(r'رقم الحديث\s+(\d+)', r'الحديث \1', fn)
    fn = fn.strip('-_ ')
    return fn if len(fn) > 3 else None


def extract_riyad(filename: str) -> str | None:
    """
    e.g. "307_رياض_الصالحين_رقم_الحديث_١٥١٩_١٥٢١.mp3"
    Want: "الحديث 1519–1521"
    """
    fn = Path(filename).stem.replace('_', ' ')
    fn = re.sub(r'^\d+[-\s]+', '', fn).strip()
    fn = re.sub(r'رياض الصالحين\s*', '', fn).strip()
    fn = normalize_nums(fn)
    fn = re.sub(r'رقم الحديث\s+(\d+)\s+(\d+)', r'الحديث \1–\2', fn)
    fn = re.sub(r'رقم الحديث\s+(\d+)', r'الحديث \1', fn)
    fn = fn.strip('-_ ')
    return fn if len(fn) > 3 else None


def extract_tafsir_saadi(filename: str) -> str | None:
    """
    e.g. "230_تفسير_السعدي_سورة_إبراهيم_الآية_٢٤_٣٤_.mp3"
    Want: "سورة إبراهيم — الآية 24–34"
    """
    fn = Path(filename).stem.replace('_', ' ')
    fn = re.sub(r'^\d+[-\s]+', '', fn).strip()
    fn = re.sub(r'تفسير السعدي\s*', '', fn).strip()
    fn = re.sub(r'تيسير الكريم الرحمن\s*', '', fn).strip()
    fn = re.sub(r'أصول وكليات التفسير\s*', '', fn).strip()
    fn = normalize_nums(fn)
    # Format "الآية X Y" → "الآية X–Y"
    fn = re.sub(r'(الآية|من الآية)\s+(\d+)\s+(\d+)', r'الآية \2–\3', fn)
    fn = re.sub(r'(الآية|من الآية)\s+(\d+)', r'الآية \2', fn)
    fn = fn.strip('-_ 1234567890')
    return fn if len(fn) > 3 else None


def extract_tafsir_surah(filename: str) -> str | None:
    """
    e.g. "01_تفسير_سورة_الأنعام_من_الآية_٠١_٠٩.mp3"
    Want: "سورة الأنعام — الآية 1–9"
    """
    fn = Path(filename).stem.replace('_', ' ')
    fn = re.sub(r'^\d+[-\s]+', '', fn).strip()
    fn = re.sub(r'تفسير\s*', '', fn).strip()
    fn = normalize_nums(fn)
    fn = re.sub(r'(من الآية|الآية)\s+0*(\d+)\s+0*(\d+)', r'الآية \2–\3', fn)
    fn = re.sub(r'(من الآية|الآية)\s+0*(\d+)', r'الآية \2', fn)
    fn = fn.strip('-_ ')
    return fn if len(fn) > 3 else None


def extract_ibn_aqeel(filename: str) -> str | None:
    """
    e.g. "001-شرح ابن عقيل على ألفية ابن مالك.mp3" → lesson 1 (no extra info)
    e.g. "شرح_ألفية_ابن_مالك_الابتداء_البيت_١٢٥_١٢٨.mp3" → "الابتداء — البيت 125–128"
    """
    fn = Path(filename).stem.replace('_', ' ')
    fn = re.sub(r'^\d+[-\s]+', '', fn).strip()
    fn = re.sub(r'شرح ابن عقيل على ألفية ابن مالك\s*', '', fn).strip()
    fn = re.sub(r'شرح ألفية ابن مالك\s*', '', fn).strip()
    fn = re.sub(r'ألفية ابن مالك\s*', '', fn).strip()
    fn = re.sub(r'ـ\s*', '', fn).strip()  # remove leading ـ
    fn = normalize_nums(fn)
    fn = re.sub(r'(من البيت|البيت)\s+(\d+)\s+(?:إلى\s+)?(\d+)', r'البيت \2–\3', fn)
    fn = re.sub(r'(من البيت|البيت)(\d+)\s+(?:إلى\s+)?(\d+)', r'البيت \2–\3', fn)
    fn = fn.strip('-_ ')
    return fn if len(fn) > 3 else None


def extract_generic(filename: str, strip_prefixes: list) -> str | None:
    """Generic extractor: strip series name prefix, clean up, return remainder."""
    fn = Path(filename).stem.replace('_', ' ')
    fn = re.sub(r'^\d+[-\s]+', '', fn).strip()
    for prefix in strip_prefixes:
        fn = re.sub(re.escape(prefix) + r'\s*', '', fn, flags=re.UNICODE).strip()
        fn = re.sub(r'^\d+[-\s]+', '', fn).strip()  # remove any secondary number
    fn = normalize_nums(fn)
    fn = re.sub(r'رقم الحديث\s+(\d+)\s+(\d+)', r'الحديث \1–\2', fn)
    fn = re.sub(r'رقم الحديث\s+(\d+)', r'الحديث \1', fn)
    fn = fn.strip('-_ ')
    return fn if len(fn) > 3 else None


# ── Router: series_slug → extractor ─────────────────────────────────────────

def get_description(series_slug: str, filename: str) -> str | None:
    fn = str(filename)
    if series_slug == 'bulugh-al-maram':
        return extract_bulugh(fn)
    elif series_slug == 'riyad-as-salihin':
        return extract_riyad(fn)
    elif series_slug == 'sunan-ibn-majah':
        return extract_sunan(fn, 'سنن ابن ماجه')
    elif series_slug == 'sunan-al-nasai':
        return extract_sunan(fn, 'سنن النسائي')
    elif series_slug == 'sunan-abi-dawud':
        return extract_generic(fn, ['سنن أبي داود', 'أبو داود'])
    elif series_slug == 'tafsir-al-saadi':
        if 'تفسير_سورة' in fn or 'تفسير سورة' in fn:
            return extract_tafsir_surah(fn)
        return extract_tafsir_saadi(fn)
    elif series_slug == 'sharh-ibn-aqeel':
        return extract_ibn_aqeel(fn)
    elif series_slug == 'al-fawakeh-al-janiyyah':
        return extract_generic(fn, ['الفواكه الجنية على متممة الجرومية', 'الفواكه الجنية'])
    elif series_slug == 'sharh-al-aqeedah-al-tahawiyyah':
        return extract_generic(fn, ['شرح العقيدة الطحاوية', 'العقيدة الطحاوية'])
    elif series_slug == 'ar-raheeq-al-makhtum':
        return extract_generic(fn, ['الرحيق المختوم'])
    elif series_slug == 'sharh-masail-al-jahiliyyah':
        return extract_generic(fn, ['شرح مسائل الجاهلية', 'مسائل الجاهلية'])
    elif series_slug == 'daaamim-manhaj-an-nubuwwah':
        return extract_generic(fn, ['دعائم منهاج النبوة'])
    elif series_slug == 'kashf-an-niqab':
        return extract_generic(fn, ['كشف النقاب عن مخدرات ملحة الإعراب', 'كشف النقاب'])
    elif series_slug == 'al-qawaaid-al-hisaan':
        return extract_generic(fn, ['القواعد الحسان المتعلقة بتفسير القرآن', 'القواعد الحسان'])
    elif series_slug == 'sharh-as-sunnah-al-barbahaariy':
        return extract_generic(fn, ['شرح السنة للبربهاري', 'السنة للبربهاري'])
    elif series_slug == 'sharh-kashf-ash-shubuhat':
        return extract_generic(fn, ['شرح كشف الشبهات', 'كشف الشبهات'])
    elif series_slug == 'al-ubudiyyah':
        return extract_generic(fn, ['العبودية لشيخ الإسلام ابن تيمية', 'العبودية'])
    elif series_slug == 'mulhat-al-iraab':
        return extract_generic(fn, ['ملحة الإعراب', 'ملحة اﻹعراب'])
    elif series_slug == 'sharh-alfiyyah-ibn-malik':
        return extract_generic(fn, ['شرح ألفية ابن مالك', 'ألفية ابن مالك'])
    elif series_slug == 'muqaddimah-al-tafsir':
        return extract_generic(fn, ['شرح مقدمة التفسير', 'مقدمة التفسير', 'مقدمة في أصول التفسير'])
    elif series_slug == 'mustalah-al-hadith':
        return extract_generic(fn, ['مصطلح الحديث'])
    elif series_slug == 'al-aqeedah-al-wasitiyyah':
        return extract_generic(fn, ['العقيدة الواسطية', 'الواسطية'])
    elif series_slug == 'al-qawl-al-mufid':
        return extract_generic(fn, ['القول المفيد على كتاب التوحيد', 'القول المفيد'])
    elif series_slug == 'wasaya-luqman':
        return extract_generic(fn, ['وصايا لقمان الحكيم لابنه', 'وصايا لقمان'])
    elif series_slug == 'dalal-al-ahbash':
        return extract_generic(fn, ['ضلال جماعة الأحباش'])
    elif series_slug == 'sharh-usool-as-sunnah':
        return extract_generic(fn, ['شرح أصول السنة', 'أصول السنة للإمام أحمد'])
    elif series_slug == 'al-usool-al-thalatha':
        return extract_generic(fn, ['ثلاثة الأصول', 'الأصول الثلاثة'])
    elif series_slug == 'usool-fi-at-tafseer':
        return extract_generic(fn, ['أصول في التفسير'])
    elif series_slug == 'ad-duroos-al-muhimmah':
        return extract_generic(fn, ['الدروس المهمة'])
    elif series_slug == 'mudhakirah-sawm':
        return extract_generic(fn, ['أحكام الصيام', 'مذكرة في أحكام الصيام'])
    return None


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    conn = connect()
    cur = conn.cursor()

    # Get all published lessons with their TG filename
    cur.execute("""
        SELECT l.id, l.title, l."lessonNumber", l.description, s.slug,
               tm."audioFilename"
        FROM lessons l
        JOIN series s ON s.id = l."seriesId"
        LEFT JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
        WHERE l.status = 'PUBLISHED'
          AND tm."audioFilename" IS NOT NULL
        ORDER BY s.slug, l."lessonNumber"
    """)
    rows = cur.fetchall()
    print(f"Processing {len(rows)} lessons...")

    updates = []
    samples = {}  # slug → [sample descriptions]
    bad = []

    for lesson_id, title, lesson_num, current_desc, slug, filename in rows:
        new_desc = get_description(slug, filename)

        if not new_desc:
            continue

        # Skip if the description is good already and not a problem
        # A "problem" description:
        # 1. Exactly matches a generic series phrase
        # 2. Same as current description but wrong
        BAD_PHRASES = [
            'من أدلة الأحكام', 'أدلة الأحكام',
            'كتاب التوحيد',  # too generic for al-qawl
            'على ألفية ابن مالك',  # fragment
        ]
        is_bad = current_desc and any(
            current_desc.strip() == p for p in BAD_PHRASES
        )

        # Always update if different and better
        if new_desc != current_desc:
            updates.append((new_desc, lesson_id))
            if slug not in samples:
                samples[slug] = []
            if len(samples[slug]) < 3:
                samples[slug].append(f"  #{lesson_num}: {new_desc[:55]}")
            if is_bad:
                bad.append(lesson_id)

    # Bulk update
    if updates:
        cur.executemany(
            'UPDATE lessons SET description=%s, "updatedAt"=NOW() WHERE id=%s',
            updates
        )
        conn.commit()
        print(f"Updated {len(updates)} descriptions ({len(bad)} were bad phrases)")
    else:
        print("Nothing to update.")

    # Print samples per series
    print("\nSample descriptions per series:")
    for slug, slist in sorted(samples.items()):
        print(f"\n  [{slug}]")
        for s in slist:
            print(s)

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == '__main__':
    main()
