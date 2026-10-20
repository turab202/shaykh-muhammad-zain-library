import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

# Lessons without B2 audio but WITH telegram file ID (can stream)
cur.execute("""
    SELECT COUNT(*) FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
      AND tm."telegramFileId" IS NOT NULL
""")
can_stream = cur.fetchone()[0]

# Lessons without B2 audio AND without telegram file ID (no audio at all)
cur.execute("""
    SELECT COUNT(*) FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
      AND tm."telegramFileId" IS NULL
""")
no_audio = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
total = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(DISTINCT l.id) FROM lessons l
    JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED'
""")
with_b2 = cur.fetchone()[0]

print(f"Total published lessons : {total}")
print(f"With B2 audio           : {with_b2}")
print(f"Can stream from Telegram: {can_stream}")
print(f"No audio source at all  : {no_audio}")
print()
print(f"Users can play: {with_b2 + can_stream} / {total} lessons ({(with_b2+can_stream)*100//total}%)")

cur.close(); conn.close()
