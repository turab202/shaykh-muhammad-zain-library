import urllib.request, json, urllib.parse

TOKEN = "8748920880:AAH-HF2Q85h5qn63qLW9Sq0W02qTJUFQpnE"
BOT_ID = 8748920880

# Check channel info
r = urllib.request.urlopen(
    f"https://api.telegram.org/bot{TOKEN}/getChat?chat_id=@SheikhMuhammedZain",
    timeout=10)
data = json.loads(r.read())
print("Channel type:", data['result'].get('type'))
print("Channel title:", data['result'].get('title'))
print("Is public:", data['result'].get('username') is not None)

# Try to forward message 3322 to bot's own chat
print("\nTrying to forward a message...")
params = urllib.parse.urlencode({
    'from_chat_id': '@SheikhMuhammedZain',
    'message_id': 3322,
    'chat_id': BOT_ID
}).encode()
try:
    r2 = urllib.request.urlopen(
        f"https://api.telegram.org/bot{TOKEN}/forwardMessage",
        data=params, timeout=15)
    result = json.loads(r2.read())
    print("Forward result:", json.dumps(result, indent=2)[:300])
except urllib.error.HTTPError as e:
    print("Forward error:", e.code, e.read().decode()[:200])
