"""Debug script: check exact Telegram auth state — tries obfuscated transport."""
import asyncio
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)

ROOT = Path(__file__).resolve().parent.parent.parent

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from telethon import TelegramClient
from telethon.network import ConnectionTcpObfuscated, ConnectionTcpFull

SESSION  = str(ROOT / "telegram" / ".session" / "importer")
API_ID   = int(os.environ["TELEGRAM_API_ID"])
API_HASH = os.environ["TELEGRAM_API_HASH"]

DCS = [
    (2, "149.154.167.41",  443),
    (1, "149.154.175.53",  443),
    (5, "91.108.56.130",   443),
]


async def try_connection(dc_id, host, port, connection_cls, label):
    print(f"\nTrying DC{dc_id} ({host}:{port}) [{label}] …")
    client = TelegramClient(
        SESSION, API_ID, API_HASH,
        connection=connection_cls,
        connection_retries=1,
        timeout=25,
        use_ipv6=False,
    )
    client.session.set_dc(dc_id, host, port)
    try:
        await asyncio.wait_for(client.connect(), timeout=25)
        print(f"  connect() returned!")
        auth = await asyncio.wait_for(client.is_user_authorized(), timeout=15)
        print(f"  is_user_authorized = {auth}")
        if auth:
            me = await client.get_me()
            print(f"  USER: {me.first_name} (id={me.id})")
        await client.disconnect()
        return auth
    except asyncio.TimeoutError:
        print(f"  TIMEOUT after 25s")
    except Exception as e:
        print(f"  Error: {type(e).__name__}: {e}")
    try:
        await client.disconnect()
    except Exception:
        pass
    return None


async def main():
    print(f"Session: {SESSION}.session ({os.path.getsize(SESSION + '.session')} bytes)")

    # First try obfuscated (bypasses DPI)
    for dc_id, host, port in DCS:
        result = await try_connection(dc_id, host, port, ConnectionTcpObfuscated, "Obfuscated")
        if result is not None:
            if result:
                print(f"\n✓ SUCCESS with Obfuscated transport on DC{dc_id}")
            else:
                print(f"\n✗ Connected but NOT authorized — need to re-auth")
            return

    # Fallback: plain TCP
    for dc_id, host, port in DCS:
        result = await try_connection(dc_id, host, port, ConnectionTcpFull, "TcpFull")
        if result is not None:
            if result:
                print(f"\n✓ SUCCESS with TcpFull on DC{dc_id}")
            else:
                print(f"\n✗ Connected but NOT authorized — need to re-auth")
            return

    print("\n✗ All connection attempts failed — MTProto is being blocked")


if __name__ == "__main__":
    asyncio.run(main())
