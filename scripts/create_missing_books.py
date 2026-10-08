"""Create book records for PDFs that have no matching book, then link them."""
import sys, json, time, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Load category IDs
cur.execute("SELECT slug, id FROM categories")
cats = dict(cur.fetchall())
print("Categories:", list(cats.keys()))

# New books to create
NEW_BOOKS = [
    ("al-raheeq-al-makhtum",     "الرحيق المختوم",           "Al-Raheeq al-Makhtum (Sealed Nectar)",     cats.get("seerah") or cats.get("adab")),
    ("al-ubudiyyah",             "العبودية",                  "Al-Ubudiyyah",                              cats.get("aqeedah")),
    ("sharh-al-aqeedah-tahawiyyah","شرح العقيدة الطحاوية",   "Sharh al-Aqeedah al-Tahawiyyah",           cats.get("aqeedah")),
    ("kashf-al-shubuhat",        "كشف الشبهات",               "Kashf ash-Shubuhat",                       cats.get("aqeedah")),
    ("masail-al-jahiliyyah",     "مسائل الجاهلية",            "Masa'il al-Jahiliyyah",                    cats.get("aqeedah")),
    ("al-duroos-al-muhimmah",    "الدروس المهمة لعامة الأمة", "Al-Duroos al-Muhimmah",                   cats.get("aqeedah")),
    ("sharh-usool-al-sunnah",    "شرح أصول السنة",            "Sharh Usool as-Sunnah",                   cats.get("aqeedah")),
    ("sharh-al-sunnah-al-barbahari","شرح السنة للبربهاري",   "Sharh as-Sunnah lil-Barbahari",           cats.get("aqeedah")),
    ("usool-al-sunnah",          "أصول السنة",                "Usool as-Sunnah",                          cats.get("aqeedah")),
    ("sunan-abi-dawud",          "سنن أبي داود",              "Sunan Abi Dawud",                          cats.get("hadith")),
    ("fiqh-al-siyam",            "أحكام الصيام",              "Fiqh al-Siyam",                            cats.get("fiqh")),
    ("dalal-al-ahbash",          "ضلال جماعة الأحباش",        "Dalal Jama'at al-Ahbash",                  cats.get("aqeedah")),
    ("sharh-ibn-aqeel",          "شرح ابن عقيل على الألفية",  "Sharh Ibn Aqeel",                          cats.get("arabic")),
    ("hashiyah-al-khudari",      "حاشية الخضري على شرح ابن عقيل","Hashiyah al-Khudari",                cats.get("arabic")),
    ("daaim-manhaj-al-nubuwwah", "دعائم منهاج النبوة",        "Daaim Manhaj al-Nubuwwah",                cats.get("aqeedah") or cats.get("usul")),
]

# Create books that don't exist
cur.execute("SELECT slug FROM books")
existing_slugs = {r[0] for r in cur.fetchall()}
book_ids = {}
cur.execute("SELECT slug, id FROM books")
for r in cur.fetchall():
    book_ids[r[0]] = r[1]

created = 0
for slug, title_ar, title_en, cat_id in NEW_BOOKS:
    if slug in existing_slugs:
        print(f"  exists: {slug}")
        continue
    book_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
    cur.execute("""
        INSERT INTO books (id, slug, title, translations, status,
                          "categoryId", "tableOfContents", "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, 'PUBLISHED', %s, '[]', NOW(), NOW())
    """, (book_id, slug, title_ar,
          json.dumps({"ar": title_ar, "en": title_en}), cat_id))
    book_ids[slug] = book_id
    print(f"  ✓ Created book: {slug}")
    created += 1

conn.commit()
print(f"\nCreated {created} new books.")

# Now link PDF media records to books
PDF_BOOK_MAP = {
    "الرحيق المختوم":            "al-raheeq-al-makhtum",
    "العبودية":                  "al-ubudiyyah",
    "شرح_العقيدة_الطحاوية":      "sharh-al-aqeedah-tahawiyyah",
    "شرح_كتاب_كشف_الشبهات":     "kashf-al-shubuhat",
    "شرح مسائل الجاهلية":        "masail-al-jahiliyyah",
    "الدروس المهمة":             "al-duroos-al-muhimmah",
    "شرح أصول السنة":            "sharh-usool-al-sunnah",
    "شرح السنة للبربهاري":       "sharh-al-sunnah-al-barbahari",
    "أصول السنة":                "usool-al-sunnah",
    "سنن أبي داود":              "sunan-abi-dawud",
    "أحكام الصيام":              "fiqh-al-siyam",
    "الصيام":                    "fiqh-al-siyam",
    "ضلال جماعة الأحباش":        "dalal-al-ahbash",
    "شرح ابن عقيل":              "sharh-ibn-aqeel",
    "arabic_02961":              "hashiyah-al-khudari",
    "دعائم منهاج النبوة":        "daaim-manhaj-al-nubuwwah",
}

cur.execute("SELECT id, filename, \"bookId\" FROM media WHERE \"mediaType\"='PDF' AND \"bookId\" IS NULL")
unlinked = cur.fetchall()
print(f"\nUnlinked PDFs: {len(unlinked)}")

linked = 0
for media_id, filename, _ in unlinked:
    matched_slug = None
    for pattern, slug in PDF_BOOK_MAP.items():
        if pattern in filename:
            matched_slug = slug
            break

    if matched_slug and matched_slug in book_ids:
        cur.execute('UPDATE media SET "bookId"=%s WHERE id=%s',
                    (book_ids[matched_slug], media_id))
        print(f"  ✓ {filename[:45]} → {matched_slug}")
        linked += 1
    else:
        print(f"  ⚠ no match: {filename[:45]}")

conn.commit()
print(f"\nLinked {linked} PDFs to books.")
cur.close()
conn.close()
