# -*- coding: utf-8 -*-
"""
Master fix script — runs all outstanding DB fixes in bulk (minimal round-trips):
1. Populate description on new lessons from TG filenames
2. Set series.order for homepage
3. Link series to their books
4. Fix missing publishedAt on lessons
"""
import sys, re, json, time, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# ─────────────────────────────────────────────────────────────────────────────
# 1. POPULATE DESCRIPTIONS IN ONE BULK UPDATE
# ─────────────────────────────────────────────────────────────────────────────
print("1. POPULATING LESSON DESCRIPTIONS ...")

_ARABIC_DIGITS = str.maketrans("١٢٣٤٥٦٧٨٩٠", "1234567890")

# Series name prefixes to strip from filenames
SERIES_PREFIXES = re.compile(
    r'(?:'
    r'تفسير السعدي|تفسير سورة|تفسير'
    r'|رياض الصالحين|بلوغ المرام'
    r'|سنن ابن ماجه|سنن النسائي|سنن أبي داود'
    r'|القول المفيد على كتاب التوحيد'
    r'|مصطلح الحديث|مقدمة في أصول التفسير|مقدمة التفسير|شرح مقدمة التفسير'
    r'|ملحة الإعراب|ملحة اﻹعراب'
    r'|الفواكه الجنية'
    r'|شرح العقيدة الطحاوية|العقيدة الطحاوية'
    r'|الرحيق المختوم'
    r'|شرح مسائل الجاهلية|مسائل الجاهلية'
    r'|دعائم منهاج النبوة'
    r'|كشف النقاب'
    r'|القواعد الحسان'
    r'|شرح السنة للبربهاري|السنة للبربهاري'
    r'|شرح كشف الشبهات|كشف الشبهات'
    r'|العبودية لشيخ الإسلام ابن تيمية|العبودية'
    r'|أصول في التفسير'
    r'|شرح ابن عقيل على ألفية ابن مالك|ابن عقيل على ألفية ابن مالك|شرح ابن عقيل'
    r'|شرح ألفية ابن مالك|ألفية ابن مالك'
    r'|شرح أصول السنة|أصول السنة للإمام أحمد'
    r'|الدروس المهمة'
    r'|وصايا لقمان الحكيم لابنه|وصايا لقمان'
    r'|ضلال جماعة الأحباش'
    r')\s*',
    re.UNICODE
)

def extract_description(filename: str) -> str | None:
    fn = Path(filename).stem
    fn = re.sub(r'^[\-_ ]+|[\-_ ]+$', '', fn)
    fn = re.sub(r'^\d+[_\- ]+', '', fn).strip()  # strip leading number
    fn = fn.replace('_', ' ').strip()
    fn = SERIES_PREFIXES.sub('', fn).strip()
    fn = fn.translate(_ARABIC_DIGITS)
    fn = re.sub(r'[\-_ ]+\d*$', '', fn).strip()
    fn = re.sub(r'_+', ' ', fn).strip()
    fn = re.sub(r'(\d+)\s+(\d+)$', r'\1–\2', fn)  # number ranges
    if not fn or re.match(r'^[\d\s\-–_]+$', fn):
        return None
    return fn[:120] if len(fn) > 2 else None

cur.execute("""
    SELECT l.id, tm."audioFilename"
    FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l.status = 'PUBLISHED'
      AND (l.description IS NULL OR l.description = '')
      AND tm."audioFilename" IS NOT NULL
""")
rows = cur.fetchall()
print(f"   Lessons missing descriptions: {len(rows)}")

# Build list of (desc, id) tuples for executemany
updates = []
for lesson_id, filename in rows:
    desc = extract_description(str(filename))
    if desc:
        updates.append((desc, lesson_id))

# Single executemany call — far fewer round-trips
if updates:
    cur.executemany(
        'UPDATE lessons SET description=%s, "updatedAt"=NOW() WHERE id=%s',
        updates
    )
    conn.commit()
    print(f"   ✓ Updated {len(updates)} descriptions (skipped {len(rows)-len(updates)} with no useful text)")
else:
    print("   Nothing to update")

# ─────────────────────────────────────────────────────────────────────────────
# 2. SET SERIES ORDER
# ─────────────────────────────────────────────────────────────────────────────
print("\n2. SETTING SERIES ORDER ...")

SERIES_ORDER = [
    # Major Hadith series
    "bulugh-al-maram",
    "sunan-abi-dawud",
    "riyad-as-salihin",
    "sunan-ibn-majah",
    "sunan-al-nasai",
    "mustalah-al-hadith",
    # Major Tafsir
    "tafsir-al-saadi",
    "muqaddimah-al-tafsir",
    "usool-fi-at-tafseer",
    "al-qawaaid-al-hisaan",
    # Aqeedah
    "al-aqeedah-al-wasitiyyah",
    "sharh-al-aqeedah-al-tahawiyyah",
    "al-qawl-al-mufid",
    "sharh-masail-al-jahiliyyah",
    "daaamim-manhaj-an-nubuwwah",
    "sharh-kashf-ash-shubuhat",
    "sharh-as-sunnah-al-barbahaariy",
    "sharh-usool-as-sunnah",
    "al-ubudiyyah",
    "al-usool-al-thalatha",
    "dalal-al-ahbash",
    "ad-duroos-al-muhimmah",
    # Arabic grammar
    "sharh-ibn-aqeel",
    "al-fawakeh-al-janiyyah",
    "kashf-an-niqab",
    "mulhat-al-iraab",
    "al-ajrumiyyah",
    "sharh-alfiyyah-ibn-malik",
    # Seerah
    "ar-raheeq-al-makhtum",
    # Fiqh / Other
    "mudhakirah-sawm",
    "wasaya-luqman",
    "ramadan-tips",
    "tafsir-ibn-kathir",
]

order_updates = [(i + 1, slug) for i, slug in enumerate(SERIES_ORDER)]
cur.executemany('UPDATE series SET "order"=%s WHERE slug=%s', order_updates)

# Everything not in list gets order 100+
cur.execute('SELECT id, slug FROM series WHERE slug != ALL(%s)', (SERIES_ORDER,))
extra = cur.fetchall()
cur.executemany('UPDATE series SET "order"=%s WHERE id=%s',
                [(100 + i, row[0]) for i, row in enumerate(extra)])

conn.commit()
print(f"   ✓ Ordered {len(SERIES_ORDER)} primary + {len(extra)} other series")

# ─────────────────────────────────────────────────────────────────────────────
# 3. LINK SERIES → BOOKS
# ─────────────────────────────────────────────────────────────────────────────
print("\n3. LINKING SERIES TO BOOKS ...")

SERIES_TO_BOOK = {
    "riyad-as-salihin":               "riyad-as-salihin",
    "bulugh-al-maram":                "bulugh-al-maram",
    "sunan-ibn-majah":                "sunan-ibn-majah",
    "sunan-al-nasai":                 "sunan-al-nasai",
    "sunan-abi-dawud":                "sunan-abi-dawud",
    "tafsir-al-saadi":                "tafsir-al-saadi",
    "tafsir-ibn-kathir":              "tafsir-ibn-kathir",
    "al-aqeedah-al-wasitiyyah":       "al-aqeedah-al-wasitiyyah",
    "sharh-al-aqeedah-al-tahawiyyah": "sharh-al-aqeedah-tahawiyyah",
    "al-qawl-al-mufid":               "al-qawl-al-mufid",
    "al-ajrumiyyah":                  "al-ajrumiyyah",
    "sharh-kashf-ash-shubuhat":       "kashf-al-shubuhat",
    "sharh-masail-al-jahiliyyah":     "masail-al-jahiliyyah",
    "dalal-al-ahbash":                "dalal-al-ahbash",
    "sharh-as-sunnah-al-barbahaariy": "sharh-al-sunnah-al-barbahari",
    "sharh-usool-as-sunnah":          "sharh-usool-al-sunnah",
    "al-ubudiyyah":                   "al-ubudiyyah",
    "ad-duroos-al-muhimmah":          "al-duroos-al-muhimmah",
    "ar-raheeq-al-makhtum":           "al-raheeq-al-makhtum",
    "sharh-ibn-aqeel":                "sharh-ibn-aqeel",
    "mudhakirah-sawm":                "fiqh-al-siyam",
    "daaamim-manhaj-an-nubuwwah":     "daaim-manhaj-al-nubuwwah",
}

cur.execute("SELECT slug, id FROM books")
book_ids = dict(cur.fetchall())

linked = 0
missing_books = []
for series_slug, book_slug in SERIES_TO_BOOK.items():
    book_id = book_ids.get(book_slug)
    if not book_id:
        missing_books.append(book_slug)
        continue
    cur.execute(
        'UPDATE series SET "bookId"=%s WHERE slug=%s AND ("bookId" IS NULL OR "bookId"!=%s)',
        (book_id, series_slug, book_id)
    )
    if cur.rowcount:
        linked += 1

conn.commit()
print(f"   ✓ Linked {linked} series to books")
if missing_books:
    print(f"   ⚠ Books not found: {missing_books}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. FIX MISSING publishedAt
# ─────────────────────────────────────────────────────────────────────────────
print("\n4. FIXING MISSING publishedAt ...")
cur.execute("""
    UPDATE lessons SET "publishedAt"="createdAt"
    WHERE status='PUBLISHED' AND "publishedAt" IS NULL
""")
fixed = cur.rowcount
conn.commit()
print(f"   ✓ Fixed {fixed} lessons")

# ─────────────────────────────────────────────────────────────────────────────
# 5. SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 55)
print("SUMMARY")
print("=" * 55)
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND description IS NOT NULL AND description!=''")
with_desc = cur.fetchone()[0]
print(f"Lessons with description: {with_desc}/{total} ({with_desc*100//max(total,1)}%)")

cur.execute("SELECT COUNT(*) FROM series WHERE status='PUBLISHED' AND \"bookId\" IS NOT NULL")
s_with_book = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM series WHERE status='PUBLISHED'")
s_total = cur.fetchone()[0]
print(f"Series linked to books  : {s_with_book}/{s_total}")

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND \"publishedAt\" IS NOT NULL")
with_pub = cur.fetchone()[0]
print(f"Lessons with publishedAt: {with_pub}/{total}")

cur.close()
conn.close()
print("\nAll fixes done.")
