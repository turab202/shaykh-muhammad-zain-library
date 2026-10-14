# -*- coding: utf-8 -*-
"""
Bulk import all unlinked Telegram messages into lessons.

Steps:
1. Creates any missing series in the DB
2. Matches every unlinked TG audio message to a series using filename patterns
3. Creates PUBLISHED lesson records for each match
4. Reports what was done and what remains unmatched

Run: py scripts/bulk_import_unlinked.py
     py scripts/bulk_import_unlinked.py --dry-run   (preview only, no DB writes)
"""
import sys, re, argparse
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

# ─────────────────────────────────────────────────────────────────────────────
# SERIES DEFINITIONS
# slug → (display_title, category_slug, arabic_name, description_en)
# ─────────────────────────────────────────────────────────────────────────────
SERIES_DEFS = {
    # Existing series (will be skipped if slug already in DB)
    "riyad-as-salihin": (
        "Riyāḍ aṣ-Ṣāliḥīn", "hadith",
        "رياض الصالحين",
        "Explanation of Riyāḍ aṣ-Ṣāliḥīn by Imām an-Nawawī"
    ),
    "bulugh-al-maram": (
        "Bulūgh al-Marām", "hadith",
        "بلوغ المرام",
        "Explanation of Bulūgh al-Marām by Ibn Ḥajar al-ʿAsqalānī"
    ),
    "sunan-ibn-majah": (
        "Sunan Ibn Mājah", "hadith",
        "سنن ابن ماجه",
        "Explanation of Sunan Ibn Mājah"
    ),
    "sunan-al-nasai": (
        "Sunan an-Nasāʾī", "hadith",
        "سنن النسائي",
        "Explanation of Sunan an-Nasāʾī"
    ),
    "tafsir-al-saadi": (
        "Tafsīr as-Saʿdī", "tafsir",
        "تفسير السعدي",
        "Tafsīr al-Qurʾān al-Karīm (Taysīr al-Karīm ar-Raḥmān) by as-Saʿdī"
    ),
    "al-ajrumiyyah": (
        "Al-Ājurrūmiyyah", "arabic",
        "الآجرومية",
        "Explanation of Al-Muqaddimah al-Ājurrūmiyyah in Arabic grammar"
    ),
    "al-aqeedah-al-wasitiyyah": (
        "Al-ʿAqīdah Al-Wāsiṭiyyah", "aqeedah",
        "العقيدة الواسطية",
        "Explanation of Al-ʿAqīdah Al-Wāsiṭiyyah by Ibn Taymiyyah"
    ),
    "al-qawl-al-mufid": (
        "Al-Qawl al-Mufīd", "aqeedah",
        "القول المفيد",
        "Explanation of Kitāb at-Tawḥīd by Shaykh Ibn ʿUthaymīn"
    ),
    "mustalah-al-hadith": (
        "Muṣṭalaḥ al-Ḥadīth", "hadith",
        "مصطلح الحديث",
        "Explanation of Muṣṭalaḥ al-Ḥadīth by Ibn ʿUthaymīn"
    ),
    "muqaddimah-al-tafsir": (
        "Muqaddimah fī Uṣūl al-Tafsīr", "tafsir",
        "مقدمة في أصول التفسير",
        "Explanation of Muqaddimah fī Uṣūl al-Tafsīr by Ibn Taymiyyah"
    ),
    "wasaya-luqman": (
        "Waṣāyā Luqmān al-Ḥakīm", "adab",
        "وصايا لقمان الحكيم",
        "Lessons from the advice of Luqmān to his son"
    ),
    "dalal-al-ahbash": (
        "Ḍalāl Jamāʿat al-Aḥbāsh", "aqeedah",
        "ضلال جماعة الأحباش",
        "Refutation of the deviant sect al-Aḥbāsh"
    ),
    # NEW SERIES — missing from DB
    "mulhat-al-iraab": (
        "Mulḥat al-Iʿrāb", "arabic",
        "ملحة الإعراب",
        "Explanation of Mulḥat al-Iʿrāb — a classical poem on Arabic grammar by al-Ḥarīrī"
    ),
    "al-fawakeh-al-janiyyah": (
        "Al-Fawākih al-Janiyyah", "arabic",
        "الفواكه الجنية",
        "Explanation of Al-Fawākih al-Janiyyah ʿalā Mutammimat al-Ājurrūmiyyah"
    ),
    "sharh-al-aqeedah-al-tahawiyyah": (
        "Sharḥ al-ʿAqīdah aṭ-Ṭaḥāwiyyah", "aqeedah",
        "شرح العقيدة الطحاوية",
        "Explanation of Al-ʿAqīdah aṭ-Ṭaḥāwiyyah by Imām Abū Jaʿfar aṭ-Ṭaḥāwī"
    ),
    "ar-raheeq-al-makhtum": (
        "Ar-Raḥīq al-Makhtūm", "seerah",
        "الرحيق المختوم",
        "Reading and explanation of Ar-Raḥīq al-Makhtūm (The Sealed Nectar) — Seerah of the Prophet ﷺ"
    ),
    "sharh-masail-al-jahiliyyah": (
        "Sharḥ Masāʾil al-Jāhiliyyah", "aqeedah",
        "شرح مسائل الجاهلية",
        "Explanation of Masāʾil al-Jāhiliyyah by Shaykh Muḥammad ibn ʿAbd al-Wahhāb"
    ),
    "daaamim-manhaj-an-nubuwwah": (
        "Daʿāʾim Manhaj an-Nubuwwah", "aqeedah",
        "دعائم منهاج النبوة",
        "Explanation of Daʿāʾim Manhaj an-Nubuwwah"
    ),
    "kashf-an-niqab": (
        "Kashf an-Niqāb ʿan Mukhaddarāt Mulḥat al-Iʿrāb", "arabic",
        "كشف النقاب",
        "Explanation of Kashf an-Niqāb — commentary on Mulḥat al-Iʿrāb"
    ),
    "al-qawaaid-al-hisaan": (
        "Al-Qawāʿid al-Ḥisān", "tafsir",
        "القواعد الحسان",
        "Explanation of Al-Qawāʿid al-Ḥisān al-Mutaʿalliqah bi-Tafsīr al-Qurʾān by as-Saʿdī"
    ),
    "sharh-as-sunnah-al-barbahaariy": (
        "Sharḥ as-Sunnah lil-Barbahārī", "aqeedah",
        "شرح السنة للبربهاري",
        "Explanation of Sharḥ as-Sunnah by Imām al-Barbahārī"
    ),
    "sharh-kashf-ash-shubuhat": (
        "Sharḥ Kashf ash-Shubuhāt", "aqeedah",
        "شرح كشف الشبهات",
        "Explanation of Kashf ash-Shubuhāt by Shaykh Muḥammad ibn ʿAbd al-Wahhāb"
    ),
    "al-ubudiyyah": (
        "Al-ʿUbūdiyyah", "aqeedah",
        "العبودية",
        "Explanation of Al-ʿUbūdiyyah by Shaykh al-Islām Ibn Taymiyyah"
    ),
    "usool-fi-at-tafseer": (
        "Uṣūl fī at-Tafsīr", "tafsir",
        "أصول في التفسير",
        "Explanation of Uṣūl fī at-Tafsīr by Shaykh Ibn ʿUthaymīn"
    ),
    "sharh-ibn-aqeel": (
        "Sharḥ Ibn ʿAqīl ʿalā Alfiyyat Ibn Mālik", "arabic",
        "شرح ابن عقيل على ألفية ابن مالك",
        "Explanation of Ibn ʿAqīl's commentary on Alfiyyat Ibn Mālik"
    ),
    "mudhakirah-sawm": (
        "Mudhakirah fī Aḥkām aṣ-Ṣiyām", "fiqh",
        "مذكرة في أحكام الصيام",
        "Notes on the rulings of fasting"
    ),
    "sharh-usool-as-sunnah": (
        "Sharḥ Uṣūl as-Sunnah lil-Imām Aḥmad", "aqeedah",
        "شرح أصول السنة",
        "Explanation of Uṣūl as-Sunnah by Imām Aḥmad ibn Ḥanbal"
    ),
    "ad-duroos-al-muhimmah": (
        "Ad-Durūs al-Muhimmah", "aqeedah",
        "الدروس المهمة",
        "Ad-Durūs al-Muhimmah li-ʿĀmmat al-Ummah by Ibn Bāz"
    ),
    "sunan-abi-dawud": (
        "Sunan Abī Dāwūd", "hadith",
        "سنن أبي داود",
        "Explanation of Sunan Abī Dāwūd"
    ),
    "al-usool-al-thalatha": (
        "Al-Uṣūl al-Thalātha", "aqeedah",
        "ثلاثة الأصول",
        "Explanation of the Three Fundamental Principles by Shaykh Muḥammad ibn ʿAbd al-Wahhāb"
    ),
    "sharh-alfiyyah-ibn-malik": (
        "Sharḥ Alfiyyat Ibn Mālik", "arabic",
        "شرح ألفية ابن مالك",
        "Explanation of the Alfiyyah of Ibn Mālik — the famous poem on Arabic grammar"
    ),
    "ramadan-tips": (
        "Ramaḍān Tips (Amharic)", "adab",
        "ምክሮች ስለ ረመዷን",
        "Ramaḍān reminders and advice in Amharic"
    ),
}

# ─────────────────────────────────────────────────────────────────────────────
# FILENAME → SERIES MATCHING RULES
# Each entry: (slug, [list of substring patterns to match in filename])
# Patterns are checked case-insensitively against the normalized filename
# (underscores → spaces, lowercased)
# ORDER MATTERS — more specific patterns first!
# ─────────────────────────────────────────────────────────────────────────────
MATCH_RULES = [
    # ── Hadith ──────────────────────────────────────────────────────────────
    ("riyad-as-salihin",        ["رياض الصالحين", "رياض_الصالحين"]),
    ("bulugh-al-maram",         ["بلوغ المرام", "بلوغ_المرام"]),
    ("sunan-ibn-majah",         ["سنن ابن ماجه", "سنن_ابن_ماجه", "ابن ماجه", "ابن_ماجه"]),
    ("sunan-al-nasai",          ["سنن النسائي", "سنن_النسائي", "النسائي"]),
    ("mustalah-al-hadith",      ["مصطلح الحديث", "مصطلح_الحديث"]),

    # ── Tafsir ──────────────────────────────────────────────────────────────
    ("tafsir-al-saadi",         ["تفسير السعدي", "تفسير_السعدي", "تفسير_سورة", "تفسير سورة"]),
    ("muqaddimah-al-tafsir",    ["مقدمة التفسير", "مقدمة_التفسير", "مقدمة في التفسير", "مقدمة_في_التفسير",
                                  "شرح مقدمة التفسير", "شرح_مقدمة_التفسير"]),
    ("usool-fi-at-tafseer",     ["أصول في التفسير", "أصول_في_التفسير"]),
    ("al-qawaaid-al-hisaan",    ["القواعد الحسان", "القواعد_الحسان"]),
    ("ar-raheeq-al-makhtum",    ["الرحيق المختوم", "الرحيق_المختوم"]),

    # ── Aqeedah ─────────────────────────────────────────────────────────────
    ("al-aqeedah-al-wasitiyyah",["العقيدة الواسطية", "الواسطية", "واسطية"]),
    ("sharh-al-aqeedah-al-tahawiyyah", ["العقيدة الطحاوية", "الطحاوية", "شرح الطحاوية", "شرح_الطحاوية"]),
    ("al-qawl-al-mufid",        ["القول المفيد", "القول_المفيد", "كتاب التوحيد"]),
    ("sharh-masail-al-jahiliyyah", ["مسائل الجاهلية", "مسائل_الجاهلية"]),
    ("daaamim-manhaj-an-nubuwwah", ["دعائم منهاج النبوة", "دعائم_منهاج_النبوة"]),
    ("sharh-kashf-ash-shubuhat",["كشف الشبهات", "كشف_الشبهات"]),
    ("sharh-as-sunnah-al-barbahaariy", ["السنة للبربهاري", "السنة_للبربهاري", "للبربهاري"]),
    ("sharh-usool-as-sunnah",   ["أصول السنة للإمام أحمد", "أصول_السنة_للإمام_أحمد",
                                  "أصول السنة للامام احمد"]),
    ("al-ubudiyyah",            ["العبودية لشيخ الإسلام", "العبودية_لشيخ_الإسلام",
                                  "العبودية لابن تيمية", "عبودية_لشيخ_الإسلام"]),
    ("dalal-al-ahbash",         ["ضلال جماعة الأحباش", "ضلال_جماعة_الأحباش", "الأحباش"]),
    ("ad-duroos-al-muhimmah",   ["الدروس المهمة", "الدروس_المهمة"]),

    # ── Arabic Grammar ──────────────────────────────────────────────────────
    ("sharh-ibn-aqeel",         ["ابن عقيل على ألفية", "ابن_عقيل_على_ألفية",
                                  "ابن عقيل على الفية", "شرح ابن عقيل"]),
    ("al-fawakeh-al-janiyyah",  ["الفواكه الجنية", "الفواكه_الجنية"]),
    ("kashf-an-niqab",          ["كشف النقاب", "كشف_النقاب"]),
    # Mulhah — two variant spellings in filenames
    ("mulhat-al-iraab",         ["ملحة الإعراب", "ملحة_الإعراب", "ملحة اﻹعراب", "ملحة اعراب"]),
    ("al-ajrumiyyah",           ["الآجرومية", "الأجرومية", "أجرومية", "آجرومية"]),

    # ── Fiqh / Other ────────────────────────────────────────────────────────
    ("mudhakirah-sawm",         ["أحكام الصيام", "أحكام_الصيام"]),
    ("wasaya-luqman",           ["وصايا لقمان", "وصايا_لقمان", "لقمان الحكيم", "لقمان_الحكيم"]),
    # Sunan Abi Dawud — multiple filename formats
    ("sunan-abi-dawud",         ["سنن أبي داود", "سنن_أبي_داود", "سنن ابي داود",
                                  "أبو داود", "أبو_داود", "ابو داود"]),
    # Al-Usool al-Thalatha
    ("al-usool-al-thalatha",    ["ثلاثة الأصول", "ثلاثة_الأصول", "الأصول الثلاثة"]),
    # Sharh Alfiyyah Ibn Malik (separate from sharh-ibn-aqeel which is Ibn Aqeel's sharh)
    ("sharh-alfiyyah-ibn-malik",["ألفية ابن مالك", "ألفية_ابن_مالك"]),
    # Ramadan tips in Amharic
    ("ramadan-tips",            ["ረመዷናዊ ምክሮች"]),
    # Al-Ubudiyyah with variant filename (no series name — just العبودية)
    ("al-ubudiyyah",            ["العبودية"]),
    # Sharh Usool as-Sunnah with format "01 - شرح أصول السنة"
    ("sharh-usool-as-sunnah",   ["أصول السنة للإمام أحمد", "أصول_السنة_للإمام_أحمد",
                                  "شرح أصول السنة", "شرح_أصول_السنة"]),
]


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    """Lowercase, replace underscores with spaces."""
    return s.replace("_", " ").lower()


def match_series(filename: str) -> str | None:
    fn_norm = normalize(filename)
    for slug, patterns in MATCH_RULES:
        for pat in patterns:
            if normalize(pat) in fn_norm:
                return slug
    return None


def extract_lesson_number(filename: str) -> int | None:
    """Extract leading number from filename: '230_تفسير...' → 230"""
    m = re.match(r'^(\d{1,4})[_ \-]', filename.strip())
    if m:
        n = int(m.group(1))
        if 1 <= n <= 9999:
            return n
    return None


def make_lesson_title(series_title: str, lesson_number: int | None, filename: str) -> str:
    if lesson_number:
        return f"{series_title} — Lesson {lesson_number}"
    # fallback: clean filename
    name = re.sub(r'^\d+[_ \-]+', '', filename)
    name = re.sub(r'\.(mp3|m4a|ogg|wav)$', '', name, flags=re.IGNORECASE)
    name = name.replace('_', ' ').strip()
    return name[:200] if name else series_title


def nanoid_like(n=21) -> str:
    """Simple random ID matching NanoID style used in the DB."""
    import random, string
    alphabet = string.ascii_letters + string.digits + '-_'
    return ''.join(random.choices(alphabet, k=n))


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Preview only, no writes')
    args = parser.parse_args()
    dry = args.dry_run

    # Fix Windows console encoding
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    if dry:
        print("DRY RUN — no changes will be written\n")

    conn = connect()
    cur = conn.cursor()

    # ── Step 1: Ensure all series exist ─────────────────────────────────────
    cur.execute("SELECT slug, id FROM series")
    existing_series = {r[0]: r[1] for r in cur.fetchall()}

    # Category slug → id map
    cur.execute('SELECT id, slug FROM categories')
    cat_map = {r[1]: r[0] for r in cur.fetchall()}

    created_series = []
    for slug, (title, category, arabic, description) in SERIES_DEFS.items():
        if slug in existing_series:
            continue
        cat_id = cat_map.get(category)
        if not dry:
            sid = nanoid_like()
            cur.execute("""
                INSERT INTO series (id, slug, title, description, "categoryId", status, "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, 'PUBLISHED', NOW(), NOW())
            """, (sid, slug, title, description, cat_id))
            existing_series[slug] = sid
            created_series.append(slug)
            print(f"  [CREATE SERIES] {slug} — {title}")
        else:
            # In dry-run, add a placeholder ID so lesson matching works
            existing_series[slug] = f"DRY-{slug}"
            print(f"  [WOULD CREATE SERIES] {slug} — {title}")

    if not dry and created_series:
        conn.commit()
        print(f"\nCreated {len(created_series)} series.\n")

    # ── Step 2: Load all unlinked TG messages ────────────────────────────────
    cur.execute("""
        SELECT tm.id, tm."messageId", tm."audioFilename"
        FROM telegram_messages tm
        LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
        WHERE tm."chatId" = '1747155048'
          AND tm."audioFilename" IS NOT NULL
          AND l.id IS NULL
        ORDER BY tm."messageId"
    """)
    unlinked = cur.fetchall()
    print(f"Unlinked TG messages: {len(unlinked)}\n")

    # ── Step 3: Load existing lessons per series (for lesson number tracking) ─
    cur.execute("""
        SELECT "seriesId", "lessonNumber"
        FROM lessons
        WHERE "lessonNumber" IS NOT NULL
    """)
    used_numbers = defaultdict(set)
    for series_id, ln in cur.fetchall():
        used_numbers[series_id].add(ln)

    # Current max lesson numbers per series (for fallback sequencing)
    cur.execute("""
        SELECT "seriesId", MAX("lessonNumber")
        FROM lessons
        WHERE "lessonNumber" IS NOT NULL
        GROUP BY "seriesId"
    """)
    max_lesson = {r[0]: r[1] for r in cur.fetchall()}

    # ── Step 4: Match and create lessons ─────────────────────────────────────
    matched = 0
    unmatched = 0
    skipped_pdf = 0
    created_lessons = defaultdict(int)
    unmatched_samples = []

    for tm_id, msg_id, filename in unlinked:
        fn = str(filename)

        # Skip PDFs that ended up as audioFilename
        if fn.lower().endswith('.pdf') or fn.lower().endswith('.webp'):
            skipped_pdf += 1
            continue

        slug = match_series(fn)
        if not slug:
            unmatched += 1
            if len(unmatched_samples) < 30:
                unmatched_samples.append((msg_id, fn))
            continue

        series_id = existing_series.get(slug)
        if not series_id:
            print(f"  WARN: series {slug} not in DB, skipping msgId {msg_id}")
            unmatched += 1
            continue

        lesson_num = extract_lesson_number(fn)

        # Avoid duplicate lesson numbers
        if lesson_num and lesson_num in used_numbers[series_id]:
            # Try to find the next available number
            lesson_num = None  # will be assigned sequentially below

        series_title = SERIES_DEFS[slug][0]
        title = make_lesson_title(series_title, lesson_num, fn)

        if lesson_num is None:
            # Assign next sequential number
            current_max = max_lesson.get(series_id, 0) or 0
            lesson_num = current_max + 1
            max_lesson[series_id] = lesson_num

        used_numbers[series_id].add(lesson_num)
        max_lesson[series_id] = max(max_lesson.get(series_id, 0), lesson_num)

        matched += 1
        created_lessons[slug] += 1

        if not dry:
            lid = nanoid_like()
            cat_id = cat_map.get(SERIES_DEFS.get(slug, ('', 'hadith'))[1])
            # Generate a unique slug from series slug + lesson number
            lesson_slug = f"{slug}-{lesson_num}" if lesson_num else f"{slug}-{nanoid_like(8)}"
            cur.execute("""
                INSERT INTO lessons (
                    id, slug, title, "lessonNumber", status,
                    "seriesId", "categoryId", "telegramSourceId",
                    "publishedAt", "createdAt", "updatedAt"
                )
                VALUES (%s, %s, %s, %s, 'PUBLISHED', %s, %s, %s, NOW(), NOW(), NOW())
            """, (lid, lesson_slug, title, lesson_num, series_id, cat_id, tm_id))

    if not dry:
        conn.commit()

    # ── Step 5: Report ────────────────────────────────────────────────────────
    print("=" * 60)
    print(f"Results {'(DRY RUN)' if dry else ''}:")
    print(f"  Matched and {'would create' if dry else 'created'}: {matched} lessons")
    print(f"  Unmatched (no series detected):                   {unmatched}")
    print(f"  Skipped (PDFs/stickers):                          {skipped_pdf}")
    print()
    print("Lessons created per series:")
    for slug, count in sorted(created_lessons.items(), key=lambda x: -x[1]):
        title = SERIES_DEFS.get(slug, (slug,))[0]
        print(f"  {count:4d}  {slug}  ({title})")

    if unmatched_samples:
        print(f"\nFirst unmatched messages (add patterns for these):")
        for msg_id, fn in unmatched_samples:
            print(f"  msgId={msg_id:5d}  {fn[:70]}")

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
