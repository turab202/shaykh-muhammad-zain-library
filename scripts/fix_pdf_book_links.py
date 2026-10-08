"""Fix PDF media records to link to the correct book IDs."""
import sys, time, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Show all books
print("Available books:")
cur.execute("SELECT id, slug, title FROM books WHERE status='PUBLISHED' ORDER BY slug")
books = {r[1]: r[0] for r in cur.fetchall()}
for slug, bid in books.items():
    print(f"  {slug}")

# The PDFs we have and their correct book mappings
PDF_BOOK_MAP = {
    # filename substring → book slug (must exist in books table)
    "مصطلح الحديث":         "mustalah-al-hadith",
    "مصطلح_الحديث":         "mustalah-al-hadith",
    "مقدمة_في_أصول_التفسير":"muqaddimah-al-tafsir",
    "القواعد_الحسان":       "muqaddimah-al-tafsir",
    "وصايا_لقمان":          "wasaya-luqman",
}

# First make sure these books exist — create if needed
BOOKS_TO_CREATE = {
    "mustalah-al-hadith":   ("مصطلح الحديث", "Muṣṭalaḥ al-Ḥadīth", "hadith"),
    "muqaddimah-al-tafsir": ("مقدمة في أصول التفسير", "Muqaddimah fī Uṣūl al-Tafsīr", "quran"),
    "wasaya-luqman":        ("وصايا لقمان", "Waṣāyā Luqmān", "general"),
}

# Find category IDs
cur.execute("SELECT id, slug FROM categories")
cats = {r[1]: r[0] for r in cur.fetchall()}
print(f"\nCategories: {list(cats.keys())}")

for slug, (title_ar, title_en, cat_hint) in BOOKS_TO_CREATE.items():
    if slug in books:
        print(f"  Book exists: {slug}")
        continue

    # Find matching category
    cat_id = None
    for cat_slug, cat_id_val in cats.items():
        if cat_hint in cat_slug:
            cat_id = cat_id_val
            break

    book_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
    import json
    cur.execute("""
        INSERT INTO books (id, slug, title, translations, status,
                          "tableOfContents", "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, 'PUBLISHED', '[]', NOW(), NOW())
        ON CONFLICT (slug) DO NOTHING
    """, (book_id, slug, title_ar,
          json.dumps({"ar": title_ar, "en": title_en})))
    conn.commit()
    books[slug] = book_id
    print(f"  Created book: {slug}")

# Now link PDF media records to books
cur.execute("SELECT id, filename FROM media WHERE \"mediaType\"='PDF' AND \"bookId\" IS NULL")
pdfs = cur.fetchall()
print(f"\nPDFs without bookId: {len(pdfs)}")

for media_id, filename in pdfs:
    matched_slug = None
    for pattern, slug in PDF_BOOK_MAP.items():
        if pattern in filename:
            matched_slug = slug
            break

    if matched_slug and matched_slug in books:
        book_id = books[matched_slug]
        cur.execute('UPDATE media SET "bookId"=%s WHERE id=%s', (book_id, media_id))
        conn.commit()
        print(f"  ✓ {filename[:50]} → {matched_slug}")
    else:
        print(f"  ⚠ No match: {filename[:50]}")

cur.close()
conn.close()
print("\nDone. Run check_books_state.py to verify.")
