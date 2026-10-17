import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()
cur.execute("""
    SELECT l."lessonNumber", l.title, l.description, tm."audioFilename"
    FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l."seriesId" = (SELECT id FROM series WHERE slug='bulugh-al-maram')
      AND l.status='PUBLISHED'
    ORDER BY l."lessonNumber"
    LIMIT 40 OFFSET 18
""")
for r in cur.fetchall():
    print(f'#{r[0]:3d}  desc={repr(r[2])[:55]}')
    print(f'       file={str(r[3])[:75]}')
cur.close(); conn.close()
