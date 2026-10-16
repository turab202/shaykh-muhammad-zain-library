import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM lessons WHERE \"bookId\" IS NOT NULL AND status='PUBLISHED'")
print('Lessons with direct bookId:', cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM lessons WHERE \"bookId\" IS NULL AND \"seriesId\" IS NOT NULL AND status='PUBLISHED'")
print('Lessons with series but no direct bookId:', cur.fetchone()[0])

# Lessons per book via series relationship
cur.execute("""
    SELECT b.slug, b.title,
           COUNT(DISTINCT l.id) FILTER(WHERE l."bookId"=b.id) as direct,
           COUNT(DISTINCT ls.id) as via_series
    FROM books b
    LEFT JOIN lessons l ON l."bookId"=b.id AND l.status='PUBLISHED'
    LEFT JOIN series s ON s."bookId"=b.id
    LEFT JOIN lessons ls ON ls."seriesId"=s.id AND ls.status='PUBLISHED'
    GROUP BY b.id, b.slug, b.title
    ORDER BY via_series DESC
    LIMIT 15
""")
print('\nBook lesson counts (direct vs via series):')
for r in cur.fetchall():
    print(f'  {r[0][:40]:40s}  direct={r[2]:4d}  via_series={r[3]:4d}')

cur.close(); conn.close()
