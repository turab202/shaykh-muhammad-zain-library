"""Quick session authorization check — run before import."""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT / ".env")


async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpMTProxyRandomizedIntermediate
    session = str(ROOT / "telegram" / ".session" / "importer")
    api_id  = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]

    # Try each reachable DC in order until one works
    dcs = [
        (2, "149.154.167.41",  443),
        (1, "149.154.175.53",  443),
        (5, "91.108.56.130",   443),
    ]

    for dc_id, host, port in dcs:
        print(f"Trying DC{dc_id} ({host}:{port}) …")
        client = TelegramClient(
            session, api_id, api_hash,
            connection_retries=2,
            timeout=15,
            use_ipv6=False,
        )
        client.session.set_dc(dc_id, host, port)
        try:
            await asyncio.wait_for(client.connect(), timeout=15)
            authorized = await asyncio.wait_for(client.is_user_authorized(), timeout=10)
            print(f"AUTHORIZED={authorized}")
            if authorized:
                me = await client.get_me()
                print(f"USER={me.first_name}  id={me.id}")
            else:
                print("Session NOT authorized — run:  py telegram/tests/telegram_auth.py")
            await client.disconnect()
            return
        except asyncio.TimeoutError:
            print(f"  DC{dc_id} timed out, trying next …")
            try:
                await client.disconnect()
            except Exception:
                pass
        except Exception as e:
            print(f"  DC{dc_id} error: {e}")
            try:
                await client.disconnect()
            except Exception:
                pass

    print("All DCs timed out. Network may be blocking MTProto protocol.")


if __name__ == "__main__":
    asyncio.run(main())
