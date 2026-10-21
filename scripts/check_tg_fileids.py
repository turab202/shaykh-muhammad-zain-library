import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

# Check what file data we have for lessons without B2 audio
cur.execute("""
    SELECT 
        COUNT(*) FILTER(WHERE tm."telegramFileId" IS NOT NULL) as with_file_id,
        COUNT(*) FILTER(WHERE tm."telegramFileId" IS NULL) as no_file_id,
        COUNT(*) as total
    FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
""")
r = cur.fetchone()
print(f"Lessons without B2 audio: {r[2]}")
print(f"  With telegramFileId: {r[0]} (can be streamed via bot)")
print(f"  Without fileId     : {r[1]} (need download)")

# Sample some file IDs
cur.execute("""
    SELECT tm."messageId", tm."telegramFileId", tm."audioFilename"
    FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
      AND tm."telegramFileId" IS NOT NULL
    LIMIT 5
""")
print("\nSample fileIds:")
for r in cur.fetchall():
    print(f"  msgId={r[0]} fileId={str(r[1])[:40]} file={str(r[2])[:40]}")

cur.close(); conn.close()
