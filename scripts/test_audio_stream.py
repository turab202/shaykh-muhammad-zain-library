"""Test the full audio stream for a lesson without B2 audio."""
import sys, os, json, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv; load_dotenv(Path(__file__).parent.parent / ".env")
from _neon import connect

token = os.environ["TELEGRAM_BOT_TOKEN"]
admin_chat = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "6669489997")

conn = connect(); cur = conn.cursor()
# Get one lesson without B2 audio that has a botFileId
cur.execute("""
    SELECT tm."messageId", tm."suggestedMetadata"->>'botFileId' as bot_file_id,
           tm."audioFilename"
    FROM telegram_messages tm
    JOIN lessons l ON l."telegramSourceId" = tm.id
    LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
    WHERE l.status='PUBLISHED' AND m.id IS NULL
      AND (tm."suggestedMetadata"->>'botFileId') IS NOT NULL
    LIMIT 1
""")
row = cur.fetchone()
cur.close(); conn.close()

if not row:
    print("No lessons with botFileId found"); exit()

msg_id, bot_file_id, filename = row
print(f"Testing lesson: {filename}")
print(f"msgId: {msg_id}")
print(f"botFileId: {bot_file_id}")

# Parse botFileId: proxy:-1003908725997:1432
parts = bot_file_id.split(":")
proxy_channel_id = ":".join(parts[1:-1])  # handles negative IDs
proxy_msg_id = parts[-1]

print(f"\nForwarding proxy channel {proxy_channel_id} msg {proxy_msg_id}...")

data = json.dumps({
    'from_chat_id': proxy_channel_id,
    'message_id': int(proxy_msg_id),
    'chat_id': admin_chat
}).encode()

try:
    req = urllib.request.Request(
        f'https://api.telegram.org/bot{token}/forwardMessage',
        data=data, headers={'Content-Type': 'application/json'}, method='POST'
    )
    r = urllib.request.urlopen(req, timeout=10)
    result = json.loads(r.read())
    if result.get('ok'):
        audio = result['result'].get('audio') or result['result'].get('document')
        if audio:
            file_id = audio['file_id']
            print(f"Got file_id: {file_id[:60]}")
            
            # Get download URL
            r2 = urllib.request.urlopen(
                f'https://api.telegram.org/bot{token}/getFile?file_id={file_id}',
                timeout=10
            )
            file_data = json.loads(r2.read())
            if file_data.get('ok'):
                file_path = file_data['result']['file_path']
                audio_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
                print(f"\nAudio URL: {audio_url[:80]}")
                print("\nFULL SUCCESS! Audio can be streamed in browser.")
            else:
                print(f"getFile failed: {file_data}")
        else:
            print("No audio in forwarded message:", result['result'])
        
        # Clean up - delete forwarded message
        del_data = json.dumps({'chat_id': admin_chat, 'message_id': result['result']['message_id']}).encode()
        del_req = urllib.request.Request(
            f'https://api.telegram.org/bot{token}/deleteMessage',
            data=del_data, headers={'Content-Type': 'application/json'}, method='POST'
        )
        urllib.request.urlopen(del_req, timeout=5)
    else:
        print(f"Forward failed: {result}")
except urllib.error.HTTPError as e:
    print(f"Error {e.code}: {e.read().decode()[:300]}")
