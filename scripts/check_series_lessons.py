# -*- coding: utf-8 -*-
"""Check how many lessons exist in Telegram vs published for each series."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Check Al-Qawl al-Mufid specifically
print("=== AL-QAWL AL-MUFID ===")
cur.execute("""
    SELECT s.id FROM series WHERE slug = 'al-qawl-al-mufid'
""")
r = cur.fetchone()
if r:
    series_id = r[0]
    cur.execute("""
        SELECT COUNT(*) FROM lessons WHERE "seriesId"=%s AND status='PUBLISHED'
    """, (series_id,))
    print(f"Published lessons: {cur.fetchone()[0]}")
    cur.execute("""
        SELECT COUNT(*) FROM lessons WHERE "seriesId"=%s
    """, (series_id,))
    print(f"Total lessons (all statuses): {cur.fetchone()[0]}")

# Check telegram messages for al-qawl-al-mufid filename pattern
print()
cur.execute("""
    SELECT tm."messageId", tm."audioFilename", l.status, l."lessonNumber"
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE tm."chatId" = '1747155048'
      AND (tm."audioFilename" ILIKE '%%قول%%مفيد%%'
           OR tm."audioFilename" ILIKE '%%القول%%'
           OR tm."suggestedMetadata"->>'series_slug' = 'al-qawl-al-mufid')
    ORDER BY tm."messageId" DESC
    LIMIT 20
""")
rows = cur.fetchall()
print(f"Telegram messages matching Al-Qawl al-Mufid: {len(rows)}")
for r in rows:
    print(f"  msgId={r[0]}  file={str(r[1])[:45]}  status={r[2]}  #={r[3]}")

print()
print("=== ALL SERIES: published vs total in telegram ===")
cur.execute("""
    SELECT s.slug,
           COUNT(DISTINCT l.id) FILTER (WHERE l.status='PUBLISHED') as published,
           COUNT(DISTINCT l.id) as total_lessons,
           COUNT(DISTINCT l.id) FILTER (WHERE l.status='DRAFT') as draft
    FROM series s
    LEFT JOIN lessons l ON l."seriesId" = s.id
    WHERE s.status = 'PUBLISHED'
    GROUP BY s.slug
    ORDER BY published DESC
""")
rows2 = cur.fetchall()
for r in rows2:
    if r[3] > 0:
        print(f"  {r[0][:35]:35s}  published={r[1]:3}  draft={r[3]:3}  (hidden!)")
    else:
        print(f"  {r[0][:35]:35s}  published={r[1]:3}")

cur.close()
conn.close()
