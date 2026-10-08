"""
Link PDFs in B2 to their book records.
- Uploads any local PDFs not yet in B2
- Creates media records for new B2 PDFs
- Updates existing media records that have bookId=NULL
"""
import sys, os, time, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config
from _neon import connect

BUCKET   = os.environ["B2_BUCKET_NAME"]
ENDPOINT = os.environ["B2_ENDPOINT"]
REGION   = ENDPOINT.split(".")[1]
ROOT     = Path(__file__).resolve().parent.parent
STORAGE  = ROOT / "storage"

s3 = boto3.client("s3",
    endpoint_url=f"https://{ENDPOINT}",
    aws_access_key_id=os.environ["B2_APPLICATION_KEY_ID"],
    aws_secret_access_key=os.environ["B2_APPLICATION_KEY"],
    region_name=REGION, config=Config(signature_version="s3v4"))

transfer_cfg = TransferConfig(multipart_threshold=100*1024*1024, max_concurrency=1)

# ── Book slug mapping (filename substring → book slug) ────────────────────────
PDF_TO_BOOK = {
    "تيسير_الكريم_الرحمن":  "tafsir-al-saadi",
    "تيسير الكريم":          "tafsir-al-saadi",
    "بلوغ المرام":           "bulugh-al-maram",
    "بلوغ_المرام":           "bulugh-al-maram",
    "متن بلوغ":              "bulugh-al-maram",
    "المقدمة الآجرومية":     "al-ajrumiyyah",
    "الآجرومية":             "al-ajrumiyyah",
    "آجرومية":               "al-ajrumiyyah",
    "الفواكه_الجنية":        "al-ajrumiyyah",
    "الفواكه الجنية":        "al-ajrumiyyah",
    "كشف_النقاب":            "al-ajrumiyyah",
    "العقيدة الواسطية":      "al-aqeedah-al-wasitiyyah",
    "الواسطية":              "al-aqeedah-al-wasitiyyah",
    "مذكرة على العقيدة":     "al-aqeedah-al-wasitiyyah",
    "رياض الصالحين":         "riyad-as-salihin",
    "سنن النسائي":           "sunan-al-nasai",
    "سنن ابن ماجه":          "sunan-ibn-majah",
    "القول المفيد":          "al-qawl-al-mufid",
    "كتاب التوحيد":          "al-qawl-al-mufid",
    "الأصول_الثلاثة":        "al-qawl-al-mufid",
    "الأصول الثلاثة":        "al-qawl-al-mufid",
    "مصطلح الحديث":          "mustalah-al-hadith",
    "مصطلح_الحديث":          "mustalah-al-hadith",
    "مقدمة التفسير":         "muqaddimah-al-tafsir",
    "أصول التفسير":          "muqaddimah-al-tafsir",
    "شرح_مقدمة_التفسير":     "muqaddimah-al-tafsir",
    "مقدمة_في_أصول_التفسير": "muqaddimah-al-tafsir",
    "القواعد_الحسان":        "muqaddimah-al-tafsir",
    "أصول_في_التفسير":       "muqaddimah-al-tafsir",
    "وصايا لقمان":           "wasaya-luqman",
    "وصايا_لقمان":           "wasaya-luqman",
}

def match_book(filename: str) -> str | None:
    for pat, slug in PDF_TO_BOOK.items():
        if pat in filename or pat.replace(" ", "_") in filename:
            return slug
    return None

# ── Step 1: Upload local PDFs under 10MB ────────────────────────────────────
print("Step 1: Upload local PDFs to B2")
r = s3.list_objects_v2(Bucket=BUCKET, Prefix="pdfs/")
in_b2 = {f["Key"] for f in r.get("Contents", [])}

local_pdfs = list(STORAGE.rglob("*.pdf")) + list(STORAGE.rglob("*.PDF"))
for p in local_pdfs:
    if p.stat().st_size > 10 * 1024 * 1024:
        continue  # skip large files
    key = f"pdfs/{p.name}"
    if key not in in_b2:
        print(f"  Uploading: {p.name[:55]} ({p.stat().st_size//1024}KB)")
        try:
            s3.upload_file(str(p), BUCKET, key,
                ExtraArgs={"ContentType": "application/pdf"}, Config=transfer_cfg)
            print(f"  ✓ Uploaded")
            in_b2.add(key)
        except Exception as e:
            print(f"  ✗ Failed: {e}")

# ── Step 2: Link all PDFs in B2 to books ─────────────────────────────────────
print("\nStep 2: Link B2 PDFs to books in DB")
r2 = s3.list_objects_v2(Bucket=BUCKET, Prefix="pdfs/")
b2_pdfs = {f["Key"]: f["Size"] for f in r2.get("Contents", [])}
print(f"PDFs in B2: {len(b2_pdfs)}")

conn = connect()
cur  = conn.cursor()

# Load book slug → id mapping
cur.execute("SELECT slug, id FROM books")
book_ids = dict(cur.fetchall())

# Get all existing PDF media records
cur.execute("""
    SELECT filename, id, "bookId"
    FROM media WHERE "mediaType" = 'PDF'
""")
existing = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

created = 0
updated = 0
no_book = 0

for b2_key, size in b2_pdfs.items():
    filename = Path(b2_key).name
    storage_key = f"s3://{BUCKET}/{b2_key}"

    book_slug = match_book(filename)
    book_id   = book_ids.get(book_slug) if book_slug else None

    if filename in existing:
        media_id, current_book_id = existing[filename]
        if current_book_id is None and book_id is not None:
            # Update existing record with book link
            cur.execute('UPDATE media SET "bookId"=%s WHERE id=%s', (book_id, media_id))
            conn.commit()
            print(f"  ✓ Updated: {filename[:45]} → {book_slug}")
            updated += 1
        elif current_book_id is not None:
            pass  # already linked
        else:
            no_book += 1
    else:
        # Create new record
        media_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
        cur.execute("""
            INSERT INTO media (id, filename, "mimeType", size, "mediaType",
                               "storageKey", "storageProvider", "bookId", "createdAt")
            VALUES (%s, %s, 'application/pdf', %s,
                    'PDF'::"MediaType", %s, 'S3'::"StorageProvider", %s, NOW())
        """, (media_id, filename, size, storage_key, book_id))
        conn.commit()
        book_info = f" → {book_slug}" if book_slug else " ⚠ no match"
        print(f"  ✓ Created: {filename[:45]}{book_info}")
        created += 1
        if not book_slug:
            no_book += 1

cur.close()
conn.close()
print(f"\nCreated={created}, Updated={updated}, No book match={no_book}")
print("Run `py scripts/check_books_state.py` to verify.")
