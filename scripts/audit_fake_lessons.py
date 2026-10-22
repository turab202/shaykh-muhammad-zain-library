# -*- coding: utf-8 -*-
"""Find and remove fake lessons (published from non-audio TG messages)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# 1. Lessons whose TG source has NO audioFilename (text messages, live announcements)
cur.execute("""
    SELECT COUNT(*) FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l.status = 'PUBLISHED'
      AND (tm."audioFilename" IS NULL
           OR lower(tm."audioFilename") LIKE '%.pdf'
           OR lower(tm."audioFilename") LIKE '%.webp'
           OR lower(tm."audioFilename") LIKE '%.apk')
""")
fake_count = cur.fetchone()[0]
print(f"Lessons from non-audio TG messages (FAKE): {fake_count}")

# 2. Lessons with no TG source at all
cur.execute("""
    SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED' AND "telegramSourceId" IS NULL
""")
no_tg = cur.fetchone()[0]
print(f"Lessons with no TG source: {no_tg}")

# 3. Total real lessons (have audio filename in TG)
cur.execute("""
    SELECT COUNT(*) FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l.status = 'PUBLISHED'
      AND tm."audioFilename" IS NOT NULL
      AND lower(tm."audioFilename") NOT LIKE '%.pdf'
      AND lower(tm."audioFilename") NOT LIKE '%.webp'
      AND lower(tm."audioFilename") NOT LIKE '%.apk'
""")
real_count = cur.fetchone()[0]
print(f"Lessons from real audio TG messages: {real_count}")
print(f"Total published: {fake_count + real_count + no_tg}")
print()

# Sample fake lessons
cur.execute("""
    SELECT l.id, l.title, tm."audioFilename", tm.caption, s.slug
    FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    JOIN series s ON s.id = l."seriesId"
    WHERE l.status = 'PUBLISHED'
      AND (tm."audioFilename" IS NULL
           OR lower(tm."audioFilename") LIKE '%.pdf'
           OR lower(tm."audioFilename") LIKE '%.webp')
    LIMIT 10
""")
print("Sample FAKE lessons (no real audio):")
for r in cur.fetchall():
    print(f"  [{r[4]}] {r[1][:40]} | file={r[2]} | cap={str(r[3])[:40]}")

cur.close(); conn.close()
