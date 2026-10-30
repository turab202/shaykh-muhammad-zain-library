"""Test forwarding a message from proxy channel via bot."""
import asyncio, os, sys, json, urllib.request, urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv; load_dotenv(Path(__file__).parent.parent / ".env")

token = os.environ["TELEGRAM_BOT_TOKEN"]
proxy_channel = os.environ["TELEGRAM_PROXY_CHANNEL_ID"]
admin_chat = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "6669489997")

from telethon import TelegramClient
from telethon.network import ConnectionTcpObfuscated

async def get_first_msg_id():
    client = TelegramClient(
        str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2"),
        int(os.environ["TELEGRAM_API_ID"]),
        os.environ["TELEGRAM_API_HASH"],
        connection=ConnectionTcpObfuscated, timeout=60
    )
    await client.start()
    proxy = await client.get_entity(int(proxy_channel))
    
    # Get first 3 messages
    async for msg in client.iter_messages(proxy, limit=3):
        print(f"  msg.id={msg.id}, has_doc={msg.document is not None}, has_audio={msg.audio is not None}")
        if msg.document or msg.audio:
            await client.disconnect()
            return msg.id
    
    await client.disconnect()
    return None

msg_id = asyncio.run(get_first_msg_id())
print(f"\nFirst audio msg_id: {msg_id}")

if msg_id:
    # Try forwarding it via Bot API
    data = json.dumps({'from_chat_id': proxy_channel, 'message_id': msg_id, 'chat_id': admin_chat}).encode()
    try:
        req = urllib.request.Request(
            f'https://api.telegram.org/bot{token}/forwardMessage',
            data=data, headers={'Content-Type': 'application/json'}, method='POST'
        )
        r = urllib.request.urlopen(req, timeout=10)
        result = json.loads(r.read())
        if result.get('ok'):
            audio = result['result'].get('audio') or result['result'].get('document')
            print(f"SUCCESS! file_id = {audio.get('file_id','')[:60] if audio else 'NO AUDIO'}")
        else:
            print(f"Failed: {result}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}: {e.read().decode()[:300]}")
