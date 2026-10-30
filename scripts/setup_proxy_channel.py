# -*- coding: utf-8 -*-
"""
Setup a proxy Telegram channel:
1. Creates a private channel
2. Adds the bot as admin
3. Forwards all audio messages to it
4. Stores bot file_ids in DB so the API can serve them

Run once: py scripts/setup_proxy_channel.py
"""
import sys, os, asyncio, json, time, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from _neon import connect

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
BOT_USERNAME = "mohammed_zain_library_bot"
SOURCE_CHANNEL = "@SheikhMuhammedZain"

async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated
    from telethon.tl.functions.channels import CreateChannelRequest, InviteToChannelRequest, EditAdminRequest
    from telethon.tl.functions.messages import ForwardMessagesRequest
    from telethon.tl.types import ChatAdminRights

    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2")
    API_ID  = int(os.environ["TELEGRAM_API_ID"])
    _HASH   = os.environ["TELEGRAM_API_HASH"]
    PHONE   = os.environ.get("TELEGRAM_PHONE", "")

    client = TelegramClient(SESSION, API_ID, _HASH,
        connection=ConnectionTcpObfuscated, timeout=60)
    await client.start(phone=PHONE if PHONE else None)
    me = await client.get_me()
    print(f"Authorized: {me.first_name}", flush=True)

    # Step 1: Create private channel
    print("Creating proxy channel...", flush=True)
    result = await client(CreateChannelRequest(
        title="Zain Library Audio Proxy",
        about="Private proxy for audio streaming",
        megagroup=False
    ))
    channel = result.chats[0]
    channel_id = channel.id
    print(f"Created channel: {channel.title} (id={channel_id})", flush=True)

    # Step 2: Add bot as admin
    print(f"Adding bot @{BOT_USERNAME} as admin...", flush=True)
    try:
        bot_entity = await client.get_entity(int(BOT_TOKEN.split(":")[0]))
        await client(InviteToChannelRequest(channel=channel, users=[bot_entity]))
        await client(EditAdminRequest(
            channel=channel,
            user_id=bot_entity,
            admin_rights=ChatAdminRights(
                post_messages=True,
                edit_messages=True,
                delete_messages=True,
                ban_users=False,
                invite_users=True,
                pin_messages=True,
                add_admins=False,
                manage_call=False,
                other=True,
            ),
            rank="Bot"
        ))
        print("Bot added as admin!", flush=True)
    except Exception as e:
        print(f"Failed to add bot: {e}", flush=True)
        return

    # Save channel ID to .env
    env_path = Path(__file__).parent.parent / ".env"
    env_content = env_path.read_text()
    if "TELEGRAM_PROXY_CHANNEL_ID" not in env_content:
        with open(env_path, "a") as f:
            f.write(f'\nTELEGRAM_PROXY_CHANNEL_ID="-100{channel_id}"\n')
    print(f"Saved channel ID: -100{channel_id}", flush=True)
    print(f"\nNow run: py scripts/forward_to_proxy.py", flush=True)

    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
