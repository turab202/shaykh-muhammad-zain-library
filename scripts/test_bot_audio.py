"""
Test if the Telegram bot can fetch an audio file from the channel.
Usage:
    $env:TELEGRAM_BOT_TOKEN="your_token"
    py scripts/test_bot_audio.py
"""
import os, sys, urllib.request, json

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
if not BOT_TOKEN:
    print("Set TELEGRAM_BOT_TOKEN env var first.")
    sys.exit(1)

# Get a known file_id from Neon
import psycopg2
NEON = "postgresql://neondb_owner:npg_rf3wYTZ7EDVa@ep-damp-haze-b1r8bscu-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=disable"
conn = psycopg2.connect(NEON, connect_timeout=20)
cur = conn.cursor()
cur.execute("""
    SELECT "messageId", "telegramFileId", "audioFilename"
    FROM telegram_messages
    WHERE "telegramFileId" IS NOT NULL
    AND "chatId" = '1747155048'
    ORDER BY "messageId" DESC LIMIT 1
""")
row = cur.fetchone()
conn.close()

if not row:
    print("No messages with fileId found in DB.")
    sys.exit(1)

msg_id, file_id, filename = row
print(f"Testing with msgId={msg_id}, file={filename}")
print(f"FileId: {file_id[:20]}...")

# Call getFile API
url = f"https://api.telegram.org/bot{BOT_TOKEN}/getFile?file_id={file_id}"
try:
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.loads(r.read())
except Exception as e:
    print(f"✗ getFile failed: {e}")
    sys.exit(1)

if data.get("ok"):
    path = data["result"]["file_path"]
    size = data["result"].get("file_size", 0)
    print(f"✓ Bot can access file!")
    print(f"  file_path : {path}")
    print(f"  file_size : {size:,} bytes ({size//1024//1024} MB)")
    print(f"\n  Audio URL : https://api.telegram.org/file/bot{BOT_TOKEN[:8]}.../{path}")
    print(f"\n  ✓ Audio will work on the live site once Vercel redeploys.")
else:
    print(f"✗ getFile returned error: {data.get('description', 'unknown')}")
    print("  Make sure the bot token is correct and the bot can access the channel.")
