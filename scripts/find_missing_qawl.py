# -*- coding: utf-8 -*-
"""Find Al-Qawl al-Mufid lessons in telegram_messages that weren't linked."""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Search ALL telegram messages for Al-Qawl al-Mufid patterns
cur.execute("""
    SELECT tm."messageId", tm."audioFilename", tm.caption,
           tm."suggestedMetadata",
           l.id as lesson_id, l."lessonNumber", l."seriesId"
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE tm."chatId" = '1747155048'
      AND (
        tm."audioFilename" ILIKE '%%قول%%'
        OR tm."audioFilename" ILIKE '%%mufid%%'
        OR tm.caption ILIKE '%%القول المفيد%%'
        OR tm.caption ILIKE '%%Al-Qawl%%'
        OR (tm."suggestedMetadata"->>'series_slug') = 'al-qawl-al-mufid'
        OR (tm."suggestedMetadata"->>'title') ILIKE '%%قول%%مفيد%%'
      )
    ORDER BY tm."messageId"
""")
rows = cur.fetchall()
print(f"Messages referencing Al-Qawl al-Mufid: {len(rows)}")
for r in rows:
    meta = r[3] if isinstance(r[3], dict) else json.loads(r[3] or '{}')
    linked = f"lesson #{r[5]}" if r[4] else "NOT LINKED"
    print(f"  msgId={r[0]:4}  {linked:15}  file={str(r[1] or '')[:45]}")
    if meta.get('series_slug'):
        print(f"           series={meta.get('series_slug')}  confidence={meta.get('confidence', '?')}")

print()
# Also check what lesson numbers exist in the series book
cur.execute("""
    SELECT b.id FROM books WHERE slug = 'al-qawl-al-mufid'
""")
book = cur.fetchone()
if book:
    cur.execute("""
        SELECT COUNT(*), MAX("lessonNumber") FROM lessons WHERE "bookId"=%s
    """, (book[0],))
    r = cur.fetchone()
    print(f"Book 'al-qawl-al-mufid': {r[0]} lessons, max lesson# = {r[1]}")

# Count how many lessons reference the book
cur.execute("""
    SELECT l."lessonNumber", l.status, l.slug
    FROM lessons l
    JOIN books b ON l."bookId" = b.id
    WHERE b.slug = 'al-qawl-al-mufid'
    ORDER BY l."lessonNumber"
""")
rows2 = cur.fetchall()
print(f"Lessons linked to book: {len(rows2)}")
for r in rows2:
    print(f"  #{r[0]:>3}  {r[1]:10}  {r[2]}")

cur.close()
conn.close()
