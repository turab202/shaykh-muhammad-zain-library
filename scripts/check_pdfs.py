"""Check PDF files in the imported Telegram messages."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect(); cur = conn.cursor()

cur.execute("""
    SELECT "messageId", "audioFilename", caption,
           "suggestedMetadata"->>'series_slug',
           "processedAt"
    FROM telegram_messages
    WHERE "chatId" = '1747155048'
      AND "audioFilename" ILIKE '%.pdf'
    ORDER BY "messageId" DESC
""")
rows = cur.fetchall()
print(f"PDF files in DB: {len(rows)}\n")
for r in rows:
    status = "PROCESSED" if r[4] else "PENDING"
    print(f"  [{status}] msgId={r[0]:5}  series={str(r[3] or '?'):<25}  {str(r[1] or '')[:60]}")
    if r[2]:
        print(f"           caption: {str(r[2])[:80]}")

conn.close()
