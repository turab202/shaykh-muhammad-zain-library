import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

# Messages with no lesson linked AND no useful audio filename
cur.execute("""
    SELECT tm."audioFilename", tm."caption", COUNT(*) as cnt
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE l.id IS NULL
      AND tm."audioFilename" IS NOT NULL
    GROUP BY tm."audioFilename", tm."caption"
    ORDER BY cnt DESC
    LIMIT 30
""")
print("=== UNLINKED messages with audioFilename (no lesson) ===")
for r in cur.fetchall():
    print(f"  {r[2]:3d}x  file={str(r[0])[:60]}  cap={str(r[1])[:30]}")

print()

# What file extensions exist?
cur.execute("""
    SELECT 
        lower(substring("audioFilename" from '\.([^.]+)$')) as ext,
        COUNT(*) as cnt
    FROM telegram_messages
    WHERE "audioFilename" IS NOT NULL
    GROUP BY ext
    ORDER BY cnt DESC
""")
print("=== All file extensions in telegram_messages ===")
for r in cur.fetchall():
    print(f"  .{r[0]:10s}  {r[1]:5d}")

cur.close(); conn.close()
