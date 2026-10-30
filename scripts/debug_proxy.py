"""Debug proxy channel message structure."""
import sys, os, asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2")
    client = TelegramClient(SESSION, int(os.environ["TELEGRAM_API_ID"]),
        os.environ["TELEGRAM_API_HASH"], connection=ConnectionTcpObfuscated, timeout=60)
    await client.start()
    
    proxy = await client.get_entity(int(os.environ["TELEGRAM_PROXY_CHANNEL_ID"]))
    
    # Get first 3 messages to understand structure
    count = 0
    async for msg in client.iter_messages(proxy, limit=3):
        print(f"\nmsg.id={msg.id}")
        print(f"  fwd_from={msg.fwd_from}")
        if msg.fwd_from:
            print(f"  fwd_from.from_id={msg.fwd_from.from_id}")
            print(f"  fwd_from.channel_post={msg.fwd_from.channel_post}")
            print(f"  fwd_from.saved_from_msg_id={msg.fwd_from.saved_from_msg_id}")
        if msg.document:
            print(f"  doc.id={msg.document.id}")
        count += 1
    
    await client.disconnect()

asyncio.run(main())
