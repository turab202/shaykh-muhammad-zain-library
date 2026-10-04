"""Test bot forward from channel with recent messages."""
import urllib.request, json
from _neon import connect

BOT = "8748920880:AAFc3LxZ_FCC4lpA6PMlqUK6WOwce5EltM8"
BOT_ID = 8748920880

# Get most recent message IDs from DB
conn = connect(); cur = conn.cursor()
cur.execute("""SELECT "messageId","audioFilename" FROM telegram_messages
    WHERE "chatId"='1747155048' ORDER BY "messageId" DESC LIMIT 5""")
rows = cur.fetchall(); conn.close()
print("Most recent message IDs in DB:")
for r in rows: print(f"  msgId={r[0]}  file={str(r[1] or '')[:50]}")

# Try forwarding the most recent one
msg_id = rows[0][0]
print(f"\nTrying to forward msgId={msg_id}...")
data = json.dumps({"chat_id": BOT_ID, "from_chat_id": "@SheikhMuhammedZain", "message_id": msg_id}).encode()
req = urllib.request.Request(f"https://api.telegram.org/bot{BOT}/forwardMessage",
    data=data, headers={"Content-Type":"application/json"})
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.loads(r.read())
        if d.get("ok"):
            result = d["result"]
            doc = result.get("document") or result.get("audio") or result.get("video")
            if doc:
                print(f"✓ Forward worked! file_id={doc['file_id'][:40]}")
            else:
                print(f"✓ Forward worked but no document. keys={list(result.keys())}")
        else:
            print(f"✗ Error: {d.get('description')}")
except urllib.error.HTTPError as e:
    d = json.loads(e.read())
    print(f"✗ HTTP Error: {d.get('description')}")
