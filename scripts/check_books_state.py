"""Check books, PDFs, and series state in DB."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

print("=" * 60)
print("BOOKS")
print("=" * 60)
cur.execute("""
    SELECT b.id, b.slug, b.title, b.status,
           COUNT(DISTINCT l.id)  AS lesson_count,
           COUNT(DISTINCT m.id)  AS pdf_count,
           MAX(m."storageKey")   AS pdf_key
    FROM books b
    LEFT JOIN lessons l ON l."bookId" = b.id AND l.status = 'PUBLISHED'
    LEFT JOIN media m   ON m."bookId"  = b.id AND m."mediaType" = 'PDF'
    GROUP BY b.id, b.slug, b.title, b.status
    ORDER BY b.status, b.title
""")
for r in cur.fetchall():
    print(f"  [{r[3]:10}] {r[1][:40]:40s}  lessons={r[4]:3}  pdfs={r[5]}  key={str(r[6] or '')[:40]}")

print()
print("=" * 60)
print("SERIES (published)")
print("=" * 60)
cur.execute("""
    SELECT s.slug, s.title, s.status,
           COUNT(DISTINCT l.id)               AS lesson_count,
           COUNT(DISTINCT CASE WHEN m.id IS NOT NULL THEN l.id END) AS with_audio
    FROM series s
    LEFT JOIN lessons l ON l."seriesId" = s.id AND l.status = 'PUBLISHED'
    LEFT JOIN media m   ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE s.status = 'PUBLISHED'
    GROUP BY s.slug, s.title, s.status
    ORDER BY lesson_count DESC
""")
for r in cur.fetchall():
    pct = f"{r[4]/r[3]*100:.0f}%" if r[3] > 0 else "n/a"
    print(f"  {r[0][:40]:40s}  lessons={r[3]:3}  audio={r[4]:3} ({pct})")

print()
print("=" * 60)
print("TELEGRAM MESSAGES — pending import summary")
print("=" * 60)
cur.execute("""
    SELECT
        COUNT(*) FILTER (WHERE "processedAt" IS NOT NULL)     AS processed,
        COUNT(*) FILTER (WHERE "processedAt" IS NULL)         AS unprocessed,
        COUNT(*) FILTER (WHERE "audioFilename" IS NOT NULL)   AS has_audio_file,
        COUNT(*)                                               AS total
    FROM telegram_messages
""")
r = cur.fetchone()
print(f"  Total messages     : {r[3]}")
print(f"  Processed          : {r[0]}")
print(f"  Unprocessed        : {r[1]}")
print(f"  Has audio filename : {r[2]}")

print()
print("=" * 60)
print("LESSONS with Telegram msgId but no B2 audio (need download)")
print("=" * 60)
cur.execute("""
    SELECT COUNT(DISTINCT l.id)
    FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE l.status = 'PUBLISHED'
      AND m.id IS NULL
      AND ts."audioFilename" IS NOT NULL
""")
r = cur.fetchone()
print(f"  Need audio download: {r[0]} lessons")

cur.close()
conn.close()
print("\nDone.")
