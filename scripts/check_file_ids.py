"""Check stored Telegram file IDs. Usage: py scripts/check_file_ids.py"""
from _neon import connect

conn = connect()
cur  = conn.cursor()
cur.execute("""
    SELECT "messageId","telegramFileId","audioFilename"
    FROM telegram_messages WHERE "chatId"='1747155048' AND "telegramFileId" IS NOT NULL
    ORDER BY "messageId" DESC LIMIT 5
""")
for r in cur.fetchall():
    print(f"msgId={r[0]}  fileId={str(r[1])[:30]:30}  file={str(r[2] or '')[:45]}")
conn.close()
