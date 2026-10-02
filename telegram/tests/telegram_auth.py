"""
One-time interactive Telegram authentication script.

Run this ONCE in a real terminal to authenticate and save the session.
After that the importer runs non-interactively.

Usage:
    py telegram/tests/telegram_auth.py

Steps:
  1. Deletes any stale session file
  2. Connects via obfuscated MTProto transport (bypasses DPI blocks)
  3. Sends a login code to TELEGRAM_PHONE from .env
  4. Prompts you to enter the code you receive via SMS/Telegram
  5. Saves session → telegram/.session/importer.session
  6. Verifies channel access

The session file is gitignored. Never share or commit it.
Do NOT print API hash, password, or session contents.
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_ROOT / ".env")

API_ID    = int(os.environ["TELEGRAM_API_ID"])
PHONE     = os.environ["TELEGRAM_PHONE"]
CHANNEL   = os.environ.get("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")
_API_HASH = os.environ["TELEGRAM_API_HASH"]  # never printed

SESSION_PATH = str(_ROOT / "telegram" / ".session" / "importer")
Path(SESSION_PATH).parent.mkdir(parents=True, exist_ok=True)

# Delete stale session so a fresh auth key is negotiated
stale = Path(SESSION_PATH + ".session")
if stale.exists():
    stale.unlink()
    print(f"Deleted stale session file.")

# DCs to try — obfuscated transport confirmed working
DCS = [
    (2, "149.154.167.41",  443),
    (1, "149.154.175.53",  443),
    (5, "91.108.56.130",   443),
    (4, "149.154.167.91",  443),
]


async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated
    from telethon.errors import SessionPasswordNeededError

    for dc_id, host, port in DCS:
        print(f"\nTrying DC{dc_id} ({host}:{port}) with obfuscated transport …")
        client = TelegramClient(
            SESSION_PATH, API_ID, _API_HASH,
            connection=ConnectionTcpObfuscated,
            connection_retries=3,
            timeout=30,
            use_ipv6=False,
        )
        client.session.set_dc(dc_id, host, port)

        try:
            await asyncio.wait_for(client.connect(), timeout=35)
            print(f"  Connected!")
        except asyncio.TimeoutError:
            print(f"  DC{dc_id} connect timed out — trying next …")
            try:
                await client.disconnect()
            except Exception:
                pass
            continue
        except Exception as e:
            print(f"  DC{dc_id} error: {e}")
            try:
                await client.disconnect()
            except Exception:
                pass
            continue

        # Fresh session — need to sign in
        already_authorized = await client.is_user_authorized()
        if already_authorized:
            me = await client.get_me()
            print(f"✓ Already authorized as: {me.first_name} (id={me.id})")
        else:
            print(f"Sending login code to {PHONE[:3]}***{PHONE[-2:]} …")
            try:
                await client.send_code_request(PHONE)
            except Exception as e:
                print(f"  send_code_request failed: {e}")
                await client.disconnect()
                continue

            code = input("Enter the Telegram login code: ").strip()
            try:
                await client.sign_in(PHONE, code)
            except SessionPasswordNeededError:
                pw = input("2FA password required: ")
                await client.sign_in(password=pw)
            except Exception as e:
                print(f"  sign_in failed: {e}")
                await client.disconnect()
                continue

            me = await client.get_me()
            print(f"✓ Signed in as: {me.first_name} (id={me.id})")

        # Verify channel
        try:
            entity = await client.get_entity(CHANNEL)
            print(f"✓ Channel verified: {getattr(entity, 'title', CHANNEL)} (id={entity.id})")
        except Exception as e:
            print(f"⚠  Channel check failed: {e}")

        await client.disconnect()
        print(f"\nSession saved → {SESSION_PATH}.session")
        print("Now run the importer:")
        print("  py -m telegram.importer.importer --live --limit 20 --no-media")
        return

    print("\n✗ All DCs failed. Check your internet connection.")


if __name__ == "__main__":
    asyncio.run(main())
