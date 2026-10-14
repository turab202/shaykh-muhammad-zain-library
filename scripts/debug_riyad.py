# -*- coding: utf-8 -*-
"""Debug: show all data for riyad-as-salihin and find unmatched TG messages."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# 1. What series slug is correct?
cur.execute("SELECT id, slug, title FROM series ORDER BY slug")
for r in cur.fetchall():
    if 'riy' in r[1].lower() or 'sali' in r[1].lower() or 'صالح' in str(r[2]):
        print(f"Series: id={r[0]} slug={r[1]} title={r[2]}")

print()

# 2. What lessons exist for riyad-as-salihin
cur.execute("""
    SELECT l.id, l."lessonNumber", l.status, l.title, l.description,
           tm."audioFilename", l."telegramSourceId"
    FROM lessons l
    LEFT JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l."seriesId" = (SELECT id FROM series WHERE slug = 'riyad-as-salihin')
    ORDER BY l."lessonNumber"
""")
rows = cur.fetchall()
print(f"Current lessons in DB for riyad-as-salihin: {len(rows)}")
for r in rows:
    print(f"  #{r[1]} status={r[2]} title={str(r[3])[:50]} file={str(r[5])[:60]}")

print()

# 3. Search TG messages for any arabic that could be riyad
cur.execute("""
    SELECT tm."messageId", tm."audioFilename"
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE tm."chatId" = '1747155048'
      AND tm."audioFilename" IS NOT NULL
      AND l.id IS NULL
      AND (
        tm."audioFilename" ILIKE '%رياض%'
        OR tm."audioFilename" ILIKE '%الصالحين%'
        OR tm."audioFilename" ILIKE '%سليم%'
        OR tm."audioFilename" ILIKE '%Riyad%'
        OR tm."audioFilename" ILIKE '%riyad%'
      )
    ORDER BY tm."messageId"
""")
rows2 = cur.fetchall()
print(f"TG messages mentioning رياض/الصالحين with no linked lesson: {len(rows2)}")
for r in rows2[:20]:
    print(f"  msgId={r[0]}  {r[1]}")

print()

# 4. Show ALL unlinked TG audio messages — first 50 by msgId range
cur.execute("""
    SELECT COUNT(*) FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE tm."chatId" = '1747155048'
      AND tm."audioFilename" IS NOT NULL
      AND l.id IS NULL
""")
total_unlinked = cur.fetchone()[0]
print(f"Total unlinked TG audio messages: {total_unlinked}")

# 5. Check lesson counts per series
cur.execute("""
    SELECT s.slug, s.title,
           COUNT(l.id) FILTER (WHERE l.status = 'PUBLISHED') AS published,
           COUNT(l.id) FILTER (WHERE l.status = 'DRAFT') AS draft
    FROM series s
    LEFT JOIN lessons l ON l."seriesId" = s.id
    GROUP BY s.id, s.slug, s.title
    ORDER BY published DESC
""")
print("\nSeries lesson counts:")
for r in cur.fetchall():
    print(f"  {r[0]}: published={r[2]} draft={r[3]} — {r[1]}")

cur.close()
conn.close()
print("\nDone.")
