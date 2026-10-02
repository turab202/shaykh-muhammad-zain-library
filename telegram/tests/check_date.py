import psycopg2, os
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
cur = conn.cursor()
cur.execute(
    'SELECT "messageId", date FROM telegram_messages WHERE "chatId" = %s ORDER BY "messageId" DESC LIMIT 5',
    ("1747155048",),
)
for r in cur.fetchall():
    print(f"msgId={r[0]}  date={r[1]}")
conn.close()
