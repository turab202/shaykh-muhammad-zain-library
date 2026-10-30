import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()
cur.execute("""
    SELECT tm."messageId", tm."telegramFileId", tm."telegramFileUniqueId", tm."audioFilename"
    FROM telegram_messages tm
    JOIN lessons l ON l."telegramSourceId" = tm.id
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
    LIMIT 5
""")
for r in cur.fetchall():
    print(f"msgId={r[0]}")
    print(f"  fileId={r[1]}")
    print(f"  uniqueId={r[2]}")
    print(f"  file={str(r[3])[:50]}")
cur.close(); conn.close()
