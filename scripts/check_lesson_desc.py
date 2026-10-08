"""Check description and audioFilename for lesson 230."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Check lesson 230 specifically
cur.execute("""
    SELECT l.slug, l.title, l.description, l."descTranslations",
           ts."audioFilename", ts."caption"
    FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    WHERE ts."messageId" = 3333
""")
rows = cur.fetchall()
for r in rows:
    print("slug          :", r[0])
    print("title         :", r[1])
    print("description   :", r[2])
    print("descTransl    :", r[3])
    print("audioFilename :", r[4])
    print("caption       :", r[5])

print()
# Also check a few other lessons to see description pattern
cur.execute("""
    SELECT l.slug, l.title, l.description, ts."audioFilename"
    FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    WHERE l.status = 'PUBLISHED'
      AND ts."audioFilename" IS NOT NULL
    LIMIT 5
""")
print("Sample lessons with audioFilename:")
for r in cur.fetchall():
    print(f"  {r[0][:45]:45s}  desc={str(r[2])[:30]:30s}  file={str(r[3])[:50]}")

conn.close()
