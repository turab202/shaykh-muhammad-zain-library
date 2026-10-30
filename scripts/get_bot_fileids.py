# -*- coding: utf-8 -*-
"""
Read all messages from the proxy channel and store bot-accessible file_ids.
The bot is admin of the proxy channel, so these file_ids work with Bot API.
"""
import sys, os, asyncio, json, time, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from _neon import connect

PROXY_CHANNEL_ID = os.environ.get("TELEGRAM_PROXY_CHANNEL_ID", "")
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")

async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2")
    API_ID  = int(os.environ["TELEGRAM_API_ID"])
    _HASH   = os.environ["TELEGRAM_API_HASH"]
    PHONE   = os.environ.get("TELEGRAM_PHONE", "")

    client = TelegramClient(SESSION, API_ID, _HASH,
        connection=ConnectionTcpObfuscated, timeout=60)
    await client.start(phone=PHONE if PHONE else None)
    print(f"Authorized: {(await client.get_me()).first_name}", flush=True)

    proxy = await client.get_entity(int(PROXY_CHANNEL_ID))
    print(f"Reading from: {proxy.title}", flush=True)

    # Get all messages from proxy channel
    # Each message is a forwarded audio — we need the file_id
    # The bot's file_id = the document/audio id accessible via Bot API

    conn = connect(); cur = conn.cursor()

    # Get all TG messages that need bot_file_id
    cur.execute("""
        SELECT tm.id, tm."messageId", tm."audioFilename",
               (tm."suggestedMetadata"->>'botFileId') as bot_file_id
        FROM telegram_messages tm
        JOIN lessons l ON l."telegramSourceId" = tm.id
        LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
        WHERE l.status='PUBLISHED' AND m.id IS NULL
          AND tm."audioFilename" IS NOT NULL
          AND lower(tm."audioFilename") NOT LIKE '%.pdf'
          AND lower(tm."audioFilename") NOT LIKE '%.webp'
        ORDER BY tm."messageId"
    """)
    missing = cur.fetchall()
    print(f"Lessons needing bot file_id: {len(missing)}", flush=True)

    # Build map: original msgId -> tm_id
    orig_to_tm = {row[1]: (row[0], row[2]) for row in missing}
    original_msg_ids = set(orig_to_tm.keys())

    # Read all messages from proxy channel
    print(f"Reading proxy channel messages...", flush=True)
    proxy_msgs = []
    async for msg in client.iter_messages(proxy, limit=None):
        if msg.document or msg.audio:
            proxy_msgs.append(msg)

    print(f"Found {len(proxy_msgs)} audio messages in proxy channel", flush=True)

    # For each proxy message, the forward_from_msg_id tells us the original message ID
    saved = 0
    for msg in proxy_msgs:
        orig_id = None
        if msg.fwd_from and msg.fwd_from.channel_post:
            orig_id = msg.fwd_from.channel_post

        if orig_id and orig_id in original_msg_ids:
            tm_id, fn = orig_to_tm[orig_id]
            # The file_id for bot API = use the document/audio id
            # Format: proxy channel id + message id
            # We store as "proxy:{channel_id}:{msg_id}" so the API knows to use proxy
            bot_ref = f"proxy:{PROXY_CHANNEL_ID}:{msg.id}"

            cur.execute("""
                UPDATE telegram_messages
                SET "suggestedMetadata" = COALESCE("suggestedMetadata", '{}'::jsonb) || %s::jsonb
                WHERE id = %s
            """, (json.dumps({"botFileId": bot_ref}), tm_id))
            saved += 1

    cur.executemany(
        'UPDATE telegram_messages SET "suggestedMetadata"=%s WHERE id=%s',
        []
    )
    conn.commit()
    print(f"Saved bot file_ids for {saved} lessons", flush=True)

    # Verify
    cur.execute("""
        SELECT COUNT(*) FROM telegram_messages
        WHERE "suggestedMetadata"->>'botFileId' IS NOT NULL
    """)
    print(f"Total with bot file_id: {cur.fetchone()[0]}", flush=True)

    cur.close(); conn.close()
    await client.disconnect()
    print("Done! Now update /api/audio route to use botFileId.", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
