import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

# Messages with NO audio filename (text messages, service messages, live notifications)
cur.execute("""
    SELECT tm."messageId", tm."audioFilename", 
           LEFT(tm.caption, 80) as cap,
           LEFT(tm.text, 80) as txt
    FROM telegram_messages tm
    WHERE tm."processedAt" IS NULL
      AND (tm."audioFilename" IS NULL 
           OR lower(tm."audioFilename") LIKE '%.pdf'
           OR lower(tm."audioFilename") LIKE '%.webp'
           OR lower(tm."audioFilename") LIKE '%.apk'
           OR lower(tm."audioFilename") LIKE '%.jpg'
           OR lower(tm."audioFilename") LIKE '%.png')
    ORDER BY tm."messageId" DESC
    LIMIT 30
""")
non_audio = cur.fetchall()
print(f"Non-audio/junk messages in inbox: {len(non_audio)}")
for r in non_audio:
    print(f"  #{r[0]:5d} file={str(r[1])[:30]:30s} cap={str(r[2])[:50]}")

print()

# Audio messages with very low confidence (likely won't ever be publishable)
cur.execute("""
    SELECT COUNT(*) FROM telegram_messages
    WHERE "processedAt" IS NULL
      AND "audioFilename" IS NOT NULL
      AND lower("audioFilename") NOT LIKE '%.pdf'
      AND lower("audioFilename") NOT LIKE '%.webp'
      AND (("suggestedMetadata"->>'confidence')::float < 0.4
           OR "suggestedMetadata"->>'series_slug' IS NULL)
""")
low_conf = cur.fetchone()[0]
print(f"Audio messages with no series / very low confidence: {low_conf}")

cur.execute("SELECT COUNT(*) FROM telegram_messages WHERE \"processedAt\" IS NULL")
total = cur.fetchone()[0]
print(f"Total pending in inbox: {total}")

cur.close(); conn.close()
