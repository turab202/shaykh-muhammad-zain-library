"""Show sample unpublished messages to improve parser."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect(); cur = conn.cursor()

print("=== LOW CONFIDENCE SAMPLE (first 30) ===")
cur.execute("""
    SELECT "messageId","audioFilename","suggestedMetadata"->>'confidence', "suggestedMetadata"->>'series_slug'
    FROM telegram_messages
    WHERE "chatId"='1747155048' AND "processedAt" IS NULL
      AND ("suggestedMetadata"->>'confidence')::float < 0.6
      AND "audioFilename" IS NOT NULL
    ORDER BY "messageId" DESC LIMIT 30
""")
for r in cur.fetchall():
    print(f"  msgId={r[0]:5}  conf={r[2]}  series={str(r[3] or '?'):<20}  {str(r[1] or '')[:70]}")

print("\n=== NO SERIES DETECTED SAMPLE (first 20) ===")
cur.execute("""
    SELECT "messageId","audioFilename","suggestedMetadata"->>'confidence', "suggestedMetadata"->>'series_slug'
    FROM telegram_messages
    WHERE "chatId"='1747155048' AND "processedAt" IS NULL
      AND ("suggestedMetadata"->>'confidence')::float >= 0.6
      AND "audioFilename" IS NOT NULL
    ORDER BY "messageId" DESC LIMIT 20
""")
for r in cur.fetchall():
    print(f"  msgId={r[0]:5}  conf={r[2]}  series={str(r[3] or '?'):<20}  {str(r[1] or '')[:70]}")

conn.close()
