import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect
conn = connect(); cur = conn.cursor()

# What's in the pending inbox?
cur.execute("""
    SELECT 
        tm."messageId",
        tm."audioFilename",
        tm."caption",
        (tm."suggestedMetadata"->>'confidence')::float as conf,
        tm."suggestedMetadata"->>'series_slug' as series,
        (tm."suggestedMetadata"->>'lesson_number') as lesson_num
    FROM telegram_messages tm
    WHERE tm."processedAt" IS NULL
    ORDER BY tm."messageId" DESC
    LIMIT 20
""")
rows = cur.fetchall()
print(f"Total pending: (showing 20 newest)")
for r in rows:
    print(f"  #{r[0]:5d}  conf={r[3] or 0:.2f}  series={r[4] or '?':35s}  file={str(r[1])[:40]}")

# Summary by series
cur.execute("""
    SELECT 
        tm."suggestedMetadata"->>'series_slug' as series,
        COUNT(*) as cnt,
        AVG((tm."suggestedMetadata"->>'confidence')::float) as avg_conf
    FROM telegram_messages tm
    WHERE tm."processedAt" IS NULL
      AND tm."audioFilename" IS NOT NULL
    GROUP BY series
    ORDER BY cnt DESC
""")
print("\nPending by series:")
total_publishable = 0
for r in cur.fetchall():
    avg = r[2] or 0
    flag = "✓ publishable" if avg >= 0.6 else "⚠ low confidence"
    print(f"  {str(r[0] or 'unknown'):35s}  {r[1]:4d} msgs  avg_conf={avg:.2f}  {flag}")
    if avg >= 0.6 and r[0]:
        total_publishable += r[1]

# Count with no audio
cur.execute("""
    SELECT COUNT(*) FROM telegram_messages
    WHERE "processedAt" IS NULL AND "audioFilename" IS NULL
""")
no_audio = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM telegram_messages WHERE "processedAt" IS NULL
""")
total = cur.fetchone()[0]

print(f"\nTotal pending: {total}")
print(f"  With audio: {total - no_audio}")
print(f"  No audio (text/service messages): {no_audio}")
print(f"  Publishable (conf>=0.6, has series): {total_publishable}")

cur.close(); conn.close()
