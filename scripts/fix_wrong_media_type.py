"""Fix media records with wrong mediaType (MP3s marked as PDF)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Find MP3 files wrongly marked as PDF
cur.execute("""
    SELECT id, filename, "mediaType", "storageKey"
    FROM media
    WHERE "mediaType" = 'PDF'
      AND (filename ILIKE '%.mp3' OR filename ILIKE '%.m4a'
           OR "storageKey" ILIKE '%.mp3' OR "storageKey" ILIKE '%.m4a')
""")
rows = cur.fetchall()
print(f"Wrong mediaType records: {len(rows)}")
for r in rows:
    print(f"  {r[1][:50]} type={r[2]}")
    cur.execute('UPDATE media SET "mediaType"=\'AUDIO\'::"MediaType" WHERE id=%s', (r[0],))

conn.commit()
print(f"Fixed {len(rows)} records.")

# Also show what PDFs remain
cur.execute("""
    SELECT m.filename, b.slug
    FROM media m
    LEFT JOIN books b ON m."bookId" = b.id
    WHERE m."mediaType" = 'PDF'
    ORDER BY b.slug
""")
rows2 = cur.fetchall()
print(f"\nActual PDF records: {len(rows2)}")
for r in rows2:
    print(f"  {r[0][:50]} -> book={r[1]}")

cur.close()
conn.close()
