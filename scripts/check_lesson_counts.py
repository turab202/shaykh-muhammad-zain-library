# -*- coding: utf-8 -*-
"""Check lesson counts and find missing lessons per series."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

print("=== LESSON STATUS COUNTS ===")
for status in ['PUBLISHED', 'DRAFT', 'ARCHIVED']:
    cur.execute("SELECT COUNT(*) FROM lessons WHERE status=%s", (status,))
    print(f"  {status}: {cur.fetchone()[0]}")

print()
print("=== SERIES: published vs draft lessons ===")
cur.execute("""
    SELECT s.slug,
           COUNT(l.id) FILTER (WHERE l.status='PUBLISHED') as pub,
           COUNT(l.id) FILTER (WHERE l.status='DRAFT') as draft,
           COUNT(l.id) FILTER (WHERE l.status='ARCHIVED') as arch
    FROM series s
    LEFT JOIN lessons l ON l."seriesId" = s.id
    WHERE s.status = 'PUBLISHED'
    GROUP BY s.slug
    HAVING COUNT(l.id) > 0
    ORDER BY pub DESC
""")
for r in cur.fetchall():
    extra = ""
    if r[2] > 0: extra += f"  ← {r[2]} HIDDEN (draft)"
    if r[3] > 0: extra += f"  ← {r[3]} archived"
    print(f"  {r[0][:35]:35s}  pub={r[1]:3}{extra}")

print()
print("=== AL-QAWL AL-MUFID: all lessons ===")
cur.execute("""
    SELECT l."lessonNumber", l.status, l.slug, ts."messageId"
    FROM lessons l
    JOIN series s ON l."seriesId" = s.id
    LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    WHERE s.slug = 'al-qawl-al-mufid'
    ORDER BY l."lessonNumber"
""")
rows = cur.fetchall()
print(f"Total: {len(rows)}")
for r in rows:
    print(f"  #{r[0]:>3}  {r[1]:10}  {r[2][:40]}  tg={r[3]}")

print()
print("=== TG MESSAGES matching Al-Qawl al-Mufid ===")
cur.execute("""
    SELECT tm."messageId", tm."audioFilename",
           tm."suggestedMetadata"->>'series_slug' as series,
           l.id as lesson_id, l.status
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE tm."chatId" = '1747155048'
      AND tm."audioFilename" ILIKE '%%قول%%مفيد%%'
    ORDER BY tm."messageId"
""")
rows2 = cur.fetchall()
print(f"Matching TG messages: {len(rows2)}")
for r in rows2:
    linked = "LINKED" if r[3] else "NOT LINKED"
    print(f"  msgId={r[0]}  {linked}  status={r[4]}  file={str(r[1])[:40]}")

cur.close()
conn.close()
