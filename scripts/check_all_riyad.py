import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

# Check all riyad lessons
cur.execute("""
    SELECT l."lessonNumber", l.status, tm."messageId", tm."audioFilename"
    FROM lessons l
    LEFT JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l."seriesId" = (SELECT id FROM series WHERE slug='riyad-as-salihin')
    ORDER BY l."lessonNumber"
""")
rows = cur.fetchall()
print(f"Riyad as-Salihin total lessons in DB: {len(rows)}")
for r in rows:
    print(f"  #{r[0]} status={r[1]} msgId={r[2]} file={str(r[3])[:60]}")

# Check what msgId range we have in telegram_messages
cur.execute("SELECT MIN(\"messageId\"), MAX(\"messageId\"), COUNT(*) FROM telegram_messages WHERE \"chatId\"='1747155048'")
r = cur.fetchone()
print(f"\nTG messages in DB: {r[2]} total, range msgId {r[0]} to {r[1]}")
print(f"Riyad lessons 1-306 would need msgIds below ~3319")
print(f"Those msgIds exist in DB but have DIFFERENT filenames (not رياض pattern)")
print(f"OR they were never downloaded from Telegram at all")

# Check: are there TG messages between msgId 1000-3300 with رياض?
cur.execute("""
    SELECT "messageId", "audioFilename" FROM telegram_messages
    WHERE "chatId"='1747155048'
      AND "audioFilename" ILIKE '%رياض%'
    ORDER BY "messageId"
""")
rows2 = cur.fetchall()
print(f"\nAll TG messages with 'رياض' in filename: {len(rows2)}")
for r in rows2:
    print(f"  msgId={r[0]} file={str(r[1])[:60]}")

cur.close(); conn.close()
