"""Check lessons with generic titles (no description) in Tafsir series."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

cur.execute("""
    SELECT l."lessonNumber", l.slug, l.description, ts.caption, ts."audioFilename"
    FROM lessons l
    JOIN series s ON l."seriesId" = s.id
    LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    WHERE s.slug = 'tafsir-al-saadi'
      AND l.status = 'PUBLISHED'
      AND (l.description IS NULL OR l.description = '')
    ORDER BY l."publishedAt", l."lessonNumber"
    LIMIT 20
""")
rows = cur.fetchall()
print(f"Tafsir lessons without description: {len(rows)}")
for r in rows:
    print(f"\n  #{r[0]:>3} {r[1][:40]}")
    print(f"  file   : {r[4]}")
    if r[3]:
        # Show first 200 chars of caption
        cap = r[3][:300].replace('\n', ' | ')
        print(f"  caption: {cap}")
    else:
        print(f"  caption: (none)")

conn.close()
