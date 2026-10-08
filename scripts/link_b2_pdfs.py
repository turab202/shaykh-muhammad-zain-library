"""
Link PDFs already in B2 to their DB records.
Creates media records for any PDF in B2 that isn't in the media table yet.
Also uploads any remaining local PDFs to B2.
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

# ── Book slug mapping ──────────────────────────────────────────────────────────
PDF_TO_BOOK = {
    "تيسير_الكريم_الرحمن": "tafsir-al-saadi",
    "تيسير الكريم":         "tafsir-al-saadi",
    "بلوغ المرام":          "bulugh-al-maram",
    "بلوغ_المرام":          "bulugh-al-maram",
    "المقدمة الآجرومية":    "al-ajrumiyyah",
    "الآجرومية":            "al-ajrumiyyah",
    "آجرومية":              "al-ajrumiyyah",
    "العقيدة الواسطية":     "al-aqeedah-al-wasitiyyah",
    "الواسطية":             "al-aqeedah-al-wasitiyyah",
    "مذكرة على العقيدة":    "al-aqeedah-al-wasitiyyah",
    "رياض الصالحين":        "riyad-as-salihin",
    "سنن النسائي":          "sunan-al-nasai",
    "سنن ابن ماجه":         "sunan-ibn-majah",
    "القول المفيد":         "al-qawl-al-mufid",
    "كتاب التوحيد":         "al-qawl-al-mufid",
    "مصطلح الحديث":         "mustalah-al-hadith",
    "مصطلح_الحديث":         "mustalah-al-hadith",
    "مقدمة التفسير":        "muqaddimah-al-tafsir",
    "أصول التفسير":         "muqaddimah-al-tafsir",
    "شرح_مقدمة_التفسير":    "muqaddimah-al-tafsir",
    "مقدمة_في_أصول_التفسير":"muqaddimah-al-tafsir",
    "القواعد_الحسان":       "muqaddimah-al-tafsir",
    "وصايا لقمان":          "wasaya-luqman",
    "وصايا_لقمان":          "wasaya-luqman",
}

def match_book(filename: str) -> str | None:
    for pat, slug in PDF_TO_BOOK.items():
        if pat in filename or pat.replace(" ", "_") in filename:
            return slug
    return None

# ── Step 1: Upload any local PDFs not in B2 yet ───────────────────────────────
print("Step 1: Upload local PDFs to B2")
r = s3.list_objects_v2(Bucket=BUCKET, Prefix="pdfs/")
in_b2 = {f["Key"] for f in r.get("Contents", [])}

local_pdfs = list(STORAGE.rglob("*.pdf")) + list(STORAGE.rglob("*.PDF"))
for p in local_pdfs:
    # Skip large files (>10MB) - upload those with import_pdfs.py instead
    if p.stat().st_size > 10 * 1024 * 1024:
        print(f"  skip (too large for this script): {p.name[:50]}")
        continue
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

# ── Step 2: Create/update media records for all PDFs in B2 ────────────────────
print("\nStep 2: Link B2 PDFs to DB")
r2 = s3.list_objects_v2(Bucket=BUCKET, Prefix="pdfs/")
b2_pdfs = {f["Key"]: f["Size"] for f in r2.get("Contents", [])}
print(f"PDFs in B2: {len(b2_pdfs)}")

conn = connect()
cur  = conn.cursor()

# Get existing media records for PDFs
cur.execute("SELECT filename FROM media WHERE \"mediaType\"='PDF'")
existing = {r[0] for r in cur.fetchall()}

linked = 0
for b2_key, size in b2_pdfs.items():
    filename = Path(b2_key).name
    storage_key = f"s3://{BUCKET}/{b2_key}"

    if filename in existing:
        print(f"  skip (exists): {filename[:50]}")
        continue

    book_slug = match_book(filename)
    book_id   = None
    if book_slug:
        cur.execute("SELECT id FROM books WHERE slug=%s", (book_slug,))
        row = cur.fetchone()
        book_id = row[0] if row else None

    media_id = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(8)}"[:25]
    cur.execute("""
        INSERT INTO media (id, filename, "mimeType", size, "mediaType",
                           "storageKey", "storageProvider", "bookId", "createdAt")
        VALUES (%s, %s, 'application/pdf', %s,
                'PDF'::"MediaType", %s, 'S3'::"StorageProvider", %s, NOW())
        ON CONFLICT DO NOTHING
    """, (media_id, filename, size, storage_key, book_id))

    # Mark telegram_message as processed
    cur.execute("""
        UPDATE telegram_messages SET "processedAt"=NOW()
        WHERE "audioFilename"=%s AND "processedAt" IS NULL
    """, (filename,))

    conn.commit()
    book_info = f" → {book_slug}" if book_slug else " ⚠ no book match"
    print(f"  ✓ {filename[:50]}{book_info}")
    linked += 1

cur.close()
conn.close()
print(f"\nLinked {linked} new PDF records.")
print("Run `py scripts/check_books_state.py` to verify.")
