import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

# Show tafsir-al-saadi lesson distribution
cur.execute("""
    SELECT l."lessonNumber", COUNT(*) as cnt,
           string_agg(substring(tm."audioFilename",1,50), ' | ') as files
    FROM lessons l
    LEFT JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l."seriesId" = (SELECT id FROM series WHERE slug='tafsir-al-saadi')
      AND l.status='PUBLISHED'
    GROUP BY l."lessonNumber"
    HAVING COUNT(*) > 1
    ORDER BY l."lessonNumber"
    LIMIT 20
""")
rows = cur.fetchall()
print(f"Tafsir al-Saadi: {len(rows)} lesson numbers with duplicates")
for r in rows[:10]:
    print(f"  #{r[0]}: {r[1]} lessons  files: {r[2][:80]}")

# Total lesson count
cur.execute("""
    SELECT COUNT(*) FROM lessons
    WHERE "seriesId" = (SELECT id FROM series WHERE slug='tafsir-al-saadi')
      AND status='PUBLISHED'
""")
print(f"\nTotal tafsir-al-saadi lessons: {cur.fetchone()[0]}")

# How many have audioFilename starting with format1 vs format2
cur.execute("""
    SELECT
        COUNT(*) FILTER(WHERE tm."audioFilename" LIKE '%تفسير_السعدي%') as saadi_format,
        COUNT(*) FILTER(WHERE tm."audioFilename" LIKE '%تفسير_سورة%') as surah_format,
        COUNT(*) FILTER(WHERE tm."audioFilename" NOT LIKE '%تفسير_السعدي%'
                          AND tm."audioFilename" NOT LIKE '%تفسير_سورة%') as other
    FROM lessons l
    JOIN telegram_messages tm ON tm.id = l."telegramSourceId"
    WHERE l."seriesId" = (SELECT id FROM series WHERE slug='tafsir-al-saadi')
      AND l.status='PUBLISHED'
""")
r = cur.fetchone()
print(f"\nFormats: تفسير_السعدي={r[0]}, تفسير_سورة={r[1]}, other={r[2]}")

cur.close(); conn.close()
