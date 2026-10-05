"""Test copyMessage and getMessages Bot API approaches."""
import urllib.request, urllib.error, json

BOT = "8748920880:AAFc3LxZ_FCC4lpA6PMlqUK6WOwce5EltM8"
BOT_ID = 8748920880
TG = f"https://api.telegram.org/bot{BOT}"

def post(method, data):
    req = urllib.request.Request(
        f"{TG}/{method}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# Test 1: copyMessage to bot's own chat
print("=== Test 1: copyMessage ===")
r = post("copyMessage", {
    "chat_id": BOT_ID,
    "from_chat_id": "@SheikhMuhammedZain",
    "message_id": 3332
})
print(f"ok={r.get('ok')}  desc={r.get('description','')}")
if r.get("ok"):
    print(f"  result keys: {list(r['result'].keys())}")
    # Delete the copied message
    if r["result"].get("message_id"):
        d = post("deleteMessage", {"chat_id": BOT_ID, "message_id": r["result"]["message_id"]})
        print(f"  deleted: {d.get('result')}")

# Test 2: forwardMessage
print("\n=== Test 2: forwardMessage ===")
r2 = post("forwardMessage", {
    "chat_id": BOT_ID,
    "from_chat_id": "@SheikhMuhammedZain",
    "message_id": 3332
})
print(f"ok={r2.get('ok')}  desc={r2.get('description','')}")
if r2.get("ok"):
    result = r2["result"]
    doc = result.get("document") or result.get("audio") or result.get("video")
    print(f"  has_document={bool(result.get('document'))} has_audio={bool(result.get('audio'))}")
    if doc:
        print(f"  file_id={doc['file_id'][:40]}")
        print(f"  file_size={doc.get('file_size',0)//1024}KB")
        # Now get the download URL
        gf = post("getFile", {"file_id": doc["file_id"]})
        if gf.get("ok"):
            path = gf["result"]["file_path"]
            print(f"  CDN URL: https://api.telegram.org/file/bot{BOT[:8]}.../{path}")
    # Clean up
    if result.get("message_id"):
        post("deleteMessage", {"chat_id": BOT_ID, "message_id": result["message_id"]})
