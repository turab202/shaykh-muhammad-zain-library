import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

cur.execute("""
    SELECT COUNT(*) FROM telegram_messages
    WHERE "suggestedMetadata"->>'botFileId' LIKE 'proxy:%'
""")
print("Messages with proxy botFileId:", cur.fetchone()[0])

cur.execute("""
    SELECT COUNT(*) FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
      AND tm."suggestedMetadata"->>'botFileId' LIKE 'proxy:%'
""")
print("Lessons without B2 audio but WITH proxy botFileId:", cur.fetchone()[0])

# Sample
cur.execute("""
    SELECT tm."messageId", tm."suggestedMetadata"->>'botFileId'
    FROM telegram_messages tm
    JOIN lessons l ON l."telegramSourceId" = tm.id
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
      AND tm."suggestedMetadata"->>'botFileId' LIKE 'proxy:%'
    LIMIT 5
""")
print("\nSamples:")
for r in cur.fetchall():
    print(f"  msgId={r[0]}  botFileId={r[1]}")

cur.close(); conn.close()
