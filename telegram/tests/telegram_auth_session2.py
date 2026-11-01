"""
Create a SECOND Telegram session for parallel downloads.
Session 1 (importer.session)  → used by GitHub Actions
Session 2 (importer2.session) → used by local machine

Both sessions connect to the same account/channel but are independent,
so they can run simultaneously without killing each other.

Usage:
    py telegram/tests/telegram_auth_session2.py
"""
import asyncio, os, sys
from pathlib import Path
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_ROOT / ".env")

API_ID    = int(os.environ["TELEGRAM_API_ID"])
PHONE     = os.environ["TELEGRAM_PHONE"]
CHANNEL   = os.environ.get("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")
_API_HASH = os.environ["TELEGRAM_API_HASH"]

# Second session — different file name
SESSION_PATH = str(_ROOT / "telegram" / ".session" / "importer2")
Path(SESSION_PATH).parent.mkdir(parents=True, exist_ok=True)

stale = Path(SESSION_PATH + ".session")
if stale.exists():
    stale.unlink()
    print("Deleted old session2 file.")

async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated
    from telethon.errors import SessionPasswordNeededError

    client = TelegramClient(
        SESSION_PATH, API_ID, _API_HASH,
        connection=ConnectionTcpObfuscated,
        connection_retries=3, timeout=30, use_ipv6=False,
    )

    print(f"\nCreating Session 2 (importer2.session)...")
    print(f"Sending code to {PHONE[:4]}***{PHONE[-2:]}...")

    await client.connect()

    await client.send_code_request(PHONE)
    code = input("Enter the Telegram login code: ").strip()

    try:
        await client.sign_in(PHONE, code)
    except SessionPasswordNeededError:
        pw = input("2FA password: ")
        await client.sign_in(password=pw)

    me = await client.get_me()
    print(f"✓ Signed in as: {me.first_name} (id={me.id})")

    entity = await client.get_entity(CHANNEL)
    print(f"✓ Channel: {getattr(entity, 'title', CHANNEL)}")

    await client.disconnect()
    print(f"\n✓ Session 2 saved → {SESSION_PATH}.session")
    print("\nNow run local downloader with session2:")
    print("  py scripts/fast_audio_downloader.py --session2")
    print("\nAnd GitHub Actions uses session1 (importer.session) independently.")

if __name__ == "__main__":
    asyncio.run(main())
