"""Remove 18 fake lessons published from non-audio TG messages."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

cur.execute("""
    DELETE FROM lessons
    WHERE id IN (
        SELECT l.id FROM lessons l
        JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
        WHERE l.status = 'PUBLISHED'
          AND (tm."audioFilename" IS NULL
               OR lower(tm."audioFilename") LIKE '%.pdf'
               OR lower(tm."audioFilename") LIKE '%.webp'
               OR lower(tm."audioFilename") LIKE '%.apk')
    )
""")
deleted = cur.rowcount
conn.commit()
print(f"Deleted {deleted} fake lessons")

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
print(f"Published lessons remaining: {cur.fetchone()[0]}")
cur.close(); conn.close()
