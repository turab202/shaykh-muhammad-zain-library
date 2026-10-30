"""Disable content protection on proxy channel using direct MTProto."""
import asyncio, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv; load_dotenv(Path(__file__).parent.parent / ".env")
from telethon import TelegramClient
from telethon.network import ConnectionTcpObfuscated

async def main():
    client = TelegramClient(
        str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2"),
        int(os.environ["TELEGRAM_API_ID"]),
        os.environ["TELEGRAM_API_HASH"],
        connection=ConnectionTcpObfuscated, timeout=60
    )
    await client.start()
    print("Connected", flush=True)

    # List all available Telethon functions
    import telethon.tl.functions as f_module
    print("Telethon version:", __import__('telethon').__version__)
    
    channel = await client.get_entity(-1003908725997)
    print(f"Channel: {channel.title}, noforwards={getattr(channel, 'noforwards', 'N/A')}")
    
    # Use the raw function call - find correct name
    import telethon.tl.functions.channels as ch_funcs
    all_funcs = [x for x in dir(ch_funcs) if not x.startswith('_')]
    print("Channel functions available:", [x for x in all_funcs if 'edit' in x.lower() or 'toggle' in x.lower()])
    
    # Try calling via client.edit method
    try:
        # Telethon 1.36+ uses different approach
        await client.edit_permissions(channel, noforwards=False)
        print("Disabled via edit_permissions!")
    except Exception as e:
        print(f"edit_permissions failed: {e}")
        try:
            # Raw API call
            from telethon.tl.types import InputChannel
            inp = await client.get_input_entity(channel)
            # Build raw TLObject
            result = await client(type('ToggleNoForwards', (), {
                'CONSTRUCTOR_ID': 0xa81b7be5,
                'SUBCLASS_OF_ID': 0x8af52aac,
            })())
        except Exception as e2:
            print(f"Raw call failed: {e2}")

    await client.disconnect()
    print("Done!")

asyncio.run(main())
