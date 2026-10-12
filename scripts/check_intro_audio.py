# -*- coding: utf-8 -*-
"""Check audio status for the early Tafsir lessons (before Surat al-Fatiha)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

cur.execute("""
    SELECT l."lessonNumber", l.description, l.slug,
           ts."messageId", ts."audioFilename",
           m."storageKey",
           CASE WHEN m."storageKey" LIKE 's3://%%' THEN 'B2 audio'
                WHEN ts."messageId" IS NOT NULL THEN 'Telegram only'
                ELSE 'No audio'
           END AS audio_status
    FROM lessons l
    JOIN series s ON l."seriesId" = s.id
    LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE s.slug = 'tafsir-al-saadi'
      AND l.status = 'PUBLISHED'
    ORDER BY l."publishedAt", l."lessonNumber"
    LIMIT 15
""")
rows = cur.fetchall()

print("First 15 Tafsir lessons (before and at Surat al-Fatiha):\n")
print(f"  {'#':>3}  {'Description':50}  {'Audio':15}  {'TG msgId'}")
print("  " + "-"*90)
for r in rows:
    num, desc, slug, msg_id, filename, key, status = r
    desc_short = str(desc or '(none)')[:48]
    print(f"  #{num:>3}  {desc_short:50}  {status:15}  {msg_id or '-'}")

conn.close()
