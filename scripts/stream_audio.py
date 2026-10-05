"""
Audio streaming helper — called by Next.js API route.
Streams a Telegram audio file to stdout.

Usage:
    py scripts/stream_audio.py <messageId> <outputFile>

Downloads the specified message's audio file from Telegram
and saves it to outputFile (or streams to stdout if outputFile is '-').

Called by /api/audio/[messageId] when no storage key is available.
"""
import asyncio
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")


async def download(msg_id: int, output_path: str):
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    api_id   = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    channel  = os.environ["TELEGRAM_CHANNEL"]
    session  = str(ROOT / "telegram" / ".session" / "importer")

    DCS = [(2,"149.154.167.41",443),(1,"149.154.175.53",443),(5,"91.108.56.130",443),(4,"149.154.167.91",443)]

    client = None
    for dc_id, host, port in DCS:
        c = TelegramClient(session, api_id, api_hash, connection=ConnectionTcpObfuscated, timeout=30)
        c.session.set_dc(dc_id, host, port)
        try:
            await asyncio.wait_for(c.connect(), timeout=35)
            if await asyncio.wait_for(c.is_user_authorized(), timeout=20):
                client = c
                break
        except Exception:
            try: await c.disconnect()
            except: pass

    if not client:
        sys.exit(1)

    entity = await client.get_entity(channel)
    msg = await client.get_messages(entity, ids=msg_id)

    if not msg or not msg.document:
        await client.disconnect()
        sys.exit(2)

    await client.download_media(msg, file=output_path)
    await client.disconnect()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: py stream_audio.py <messageId> <outputPath>")
        sys.exit(1)

    msg_id = int(sys.argv[1])
    output = sys.argv[2]

    asyncio.run(download(msg_id, output))
    print(f"Downloaded to: {output}", file=sys.stderr)
