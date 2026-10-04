"""Test bot audio access. Usage: py scripts/test_bot_audio.py"""
import os, urllib.request, json
from _neon import connect
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BOT = os.environ.get("TELEGRAM_BOT_TOKEN","")
if not BOT:
    print("Set TELEGRAM_BOT_TOKEN in .env"); raise SystemExit(1)

conn = connect(); cur = conn.cursor()
cur.execute("""SELECT "messageId","telegramFileId","audioFilename"
    FROM telegram_messages WHERE "telegramFileId" IS NOT NULL AND "chatId"='1747155048'
    ORDER BY "messageId" DESC LIMIT 1""")
row = cur.fetchone(); conn.close()
if not row: print("No messages found"); raise SystemExit(1)

msg_id, file_id, filename = row
print(f"Testing msgId={msg_id}  file={filename}")

with urllib.request.urlopen(f"https://api.telegram.org/bot{BOT}/getMe", timeout=10) as r:
    d = json.loads(r.read())
    print(f"Bot: @{d['result']['username']}  id={d['result']['id']}")
