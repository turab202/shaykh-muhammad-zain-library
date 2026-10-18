import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

# What the workflow auto-detects
cur.execute("""
    SELECT MAX(ts."messageId") + 5 as auto_start,
           MIN(ts."messageId") as min_msg,
           MAX(ts."messageId") as max_msg,
           COUNT(*) as count
    FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE l.status = 'PUBLISHED' AND m.id IS NULL
""")
r = cur.fetchone()
print(f"Lessons needing audio: {r[3]}")
print(f"MessageId range: {r[1]} to {r[2]}")
print(f"Workflow auto start_id would be: {r[0]}")
print()
print("For GitHub Actions MANUAL trigger, use start_id=3335")
print("This makes the workflow start from the TOP and page all the way down")
print("covering ALL msgIds 3335→150 in order")
print()

# How many lessons per msgId range
cur.execute("""
    SELECT (ts."messageId" / 500) * 500 as range_start, COUNT(*) as cnt
    FROM lessons l
    JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE l.status = 'PUBLISHED' AND m.id IS NULL
    GROUP BY range_start
    ORDER BY range_start
""")
print("Distribution of remaining lessons by msgId range:")
for row in cur.fetchall():
    bar = '#' * min(row[1] // 5, 40)
    print(f"  msgId {row[0]:5d}-{row[0]+499:5d}: {row[1]:4d}  {bar}")

cur.close(); conn.close()
