"""Show current state of published content in the DB."""
import psycopg2, os
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
cur = conn.cursor()

print("\n=== PUBLISHED LESSONS ===")
cur.execute('SELECT slug, title, status FROM lessons ORDER BY "publishedAt" DESC')
rows = cur.fetchall()
published = [r for r in rows if r[2] == "PUBLISHED"]
draft = [r for r in rows if r[2] == "DRAFT"]
print(f"Published : {len(published)}")
print(f"Draft     : {len(draft)}")
for r in published:
    print(f"  [PUB] {r[0][:55]}")
for r in draft:
    print(f"  [DFT] {r[0][:55]}")

print("\n=== MEDIA (audio storageKeys) ===")
cur.execute('SELECT filename, "storageKey", "mimeType" FROM media ORDER BY "createdAt" LIMIT 15')
for r in cur.fetchall():
    print(f"  {r[0][:40]:40}  key={r[1][:60]}")

print("\n=== TELEGRAM INBOX (real channel) ===")
cur.execute('SELECT "messageId", "audioFilename", "processedAt" FROM telegram_messages WHERE "chatId" = %s ORDER BY "messageId" DESC', ("1747155048",))
for r in cur.fetchall():
    status = "REVIEWED" if r[2] else "PENDING"
    fn = str(r[1]) if r[1] else "(text only)"
    print(f"  [{status}] msgId={r[0]:5}  {fn[:55]}")

conn.close()
