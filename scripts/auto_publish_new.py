# -*- coding: utf-8 -*-
"""
Auto-publish new lessons from Telegram channel.
Runs on GitHub Actions (or locally) to check for new messages.

Steps:
1. Fetch messages newer than the last known message in DB
2. Parse series/lesson number from filename
3. Auto-publish as lessons
4. Forward to proxy channel so bot can stream them
5. Map bot file_ids to lessons

Run: py scripts/auto_publish_new.py
"""
import sys, os, asyncio, json, time, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from _neon import connect

PROXY_CHANNEL_ID = os.environ.get("TELEGRAM_PROXY_CHANNEL_ID", "")

async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated
    from telethon.tl.functions.messages import ForwardMessagesRequest

    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer")
    API_ID  = int(os.environ["TELEGRAM_API_ID"])
    _HASH   = os.environ["TELEGRAM_API_HASH"]
    PHONE   = os.environ.get("TELEGRAM_PHONE", "")
    CHANNEL = os.environ.get("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")

    conn = connect(); cur = conn.cursor()

    # Get the highest messageId we have
    cur.execute('SELECT MAX("messageId") FROM telegram_messages WHERE "chatId"=\'1747155048\'')
    max_known = cur.fetchone()[0] or 0
    print(f"Last known message ID: {max_known}", flush=True)

    client = TelegramClient(SESSION, API_ID, _HASH,
        connection=ConnectionTcpObfuscated, connection_retries=5, timeout=120)
    await client.start(phone=PHONE if PHONE else None)
    print(f"Authorized: {(await client.get_me()).first_name}", flush=True)

    source = await client.get_entity(CHANNEL)

    # Get messages newer than max_known
    new_msgs = []
    async for msg in client.iter_messages(source, limit=100):
        if msg.id <= max_known:
            break
        if msg.document or msg.audio:
            new_msgs.append(msg)

    print(f"New messages: {len(new_msgs)}", flush=True)

    if not new_msgs:
        print("No new messages. Up to date!")
        await client.disconnect()
        cur.close(); conn.close()
        return

    # Import using the existing importer pipeline
    import subprocess
    result = subprocess.run([
        sys.executable, "-m", "telegram.importer.importer",
        "--live", "--limit", str(len(new_msgs) + 10),
        "--auto-publish",
    ], cwd=str(Path(__file__).parent.parent))

    if result.returncode != 0:
        print("Import failed")
        await client.disconnect()
        cur.close(); conn.close()
        return

    # Forward new messages to proxy channel for bot access
    if PROXY_CHANNEL_ID and new_msgs:
        print(f"Forwarding {len(new_msgs)} new messages to proxy channel...", flush=True)
        try:
            proxy = await client.get_entity(int(PROXY_CHANNEL_ID))
            result = await client(ForwardMessagesRequest(
                from_peer=source,
                id=[m.id for m in new_msgs],
                to_peer=proxy,
                drop_author=True,
                silent=True,
            ))
            print(f"Forwarded to proxy channel!", flush=True)
        except Exception as e:
            print(f"Forward failed: {e}", flush=True)

    # Map new proxy messages to bot file_ids
    if PROXY_CHANNEL_ID:
        print("Mapping bot file_ids for new messages...", flush=True)

        proxy = await client.get_entity(int(PROXY_CHANNEL_ID))
        doc_to_proxy = {}
        async for msg in client.iter_messages(proxy, limit=len(new_msgs) + 5):
            if msg.document:
                doc_to_proxy[msg.document.id] = msg.id

        for orig_msg in new_msgs:
            doc_id = orig_msg.document.id if orig_msg.document else None
            if doc_id and doc_id in doc_to_proxy:
                proxy_msg_id = doc_to_proxy[doc_id]
                bot_ref = f"proxy:{PROXY_CHANNEL_ID}:{proxy_msg_id}"
                cur.execute("""
                    UPDATE telegram_messages
                    SET "suggestedMetadata" = COALESCE("suggestedMetadata",'{}') || %s::jsonb
                    WHERE "messageId"=%s AND "chatId"='1747155048'
                """, (json.dumps({"botFileId": bot_ref}), orig_msg.id))
                print(f"  Mapped msgId={orig_msg.id} → proxy {proxy_msg_id}", flush=True)

        conn.commit()

    await client.disconnect()
    cur.close(); conn.close()
    print("Done! New lessons published and mapped.", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
