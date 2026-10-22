"""Check if all published lessons are real (have TG source or audio)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

# Lessons with NO telegram source at all (placeholder/manual)
cur.execute("""
    SELECT COUNT(*) FROM lessons
    WHERE status='PUBLISHED' AND "telegramSourceId" IS NULL
""")
no_tg = cur.fetchone()[0]

# Lessons WITH telegram source (real lessons from channel)
cur.execute("""
    SELECT COUNT(*) FROM lessons
    WHERE status='PUBLISHED' AND "telegramSourceId" IS NOT NULL
""")
with_tg = cur.fetchone()[0]

# Lessons with audio
cur.execute("""
    SELECT COUNT(DISTINCT l.id) FROM lessons l
    JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED'
""")
with_audio = cur.fetchone()[0]

# Lessons from inbox (published from clean_inbox - these have TG source)
cur.execute("""
    SELECT COUNT(*) FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l.status='PUBLISHED' AND tm."processedAt" IS NOT NULL
""")
from_inbox = cur.fetchone()[0]

print(f"Total published    : {with_tg + no_tg}")
print(f"  From Telegram    : {with_tg} (real lessons)")
print(f"  No TG source     : {no_tg} (manual/placeholder)")
print(f"  With audio       : {with_audio}")
print(f"  From inbox       : {from_inbox}")
print()

# Sample 5 newest lessons from inbox to verify they're real
cur.execute("""
    SELECT l.title, l."lessonNumber", s.slug, tm."audioFilename"
    FROM lessons l
    JOIN series s ON s.id = l."seriesId"
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l.status='PUBLISHED'
    ORDER BY l."createdAt" DESC
    LIMIT 10
""")
print("10 most recently published lessons:")
for r in cur.fetchall():
    print(f"  [{r[2]}] #{r[1]} {r[0][:40]} | file: {str(r[3])[:45]}")

cur.close(); conn.close()
