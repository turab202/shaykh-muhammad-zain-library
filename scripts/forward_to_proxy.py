# -*- coding: utf-8 -*-
"""
Forward all audio messages from @SheikhMuhammedZain to the proxy channel.
The bot then gets file_ids for each message and we store them in DB.

Run after setup_proxy_channel.py:
    py scripts/forward_to_proxy.py
"""
import sys, os, asyncio, time, json, secrets
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from _neon import connect
import urllib.request

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
PROXY_CHANNEL_ID = os.environ.get("TELEGRAM_PROXY_CHANNEL_ID", "")

def get_bot_file_id(msg_id_in_proxy_channel):
    """Get bot-accessible file_id from forwarded message."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getMessages?chat_id={PROXY_CHANNEL_ID}&message_ids=[{msg_id_in_proxy_channel}]"
    try:
        r = urllib.request.urlopen(url, timeout=10)
        data = json.loads(r.read())
        if data.get("ok"):
            msg = data["result"][0] if data["result"] else None
            if msg and msg.get("audio"):
                return msg["audio"]["file_id"]
            if msg and msg.get("document"):
                return msg["document"]["file_id"]
    except Exception as e:
        print(f"  Bot API error: {e}")
    return None

def save_bot_file_id(tm_id, bot_file_id):
    """Save bot-accessible file_id to TG message record."""
    conn = connect(); cur = conn.cursor()
    try:
        # Store in suggestedMetadata for now
        cur.execute("""
            UPDATE telegram_messages
            SET "suggestedMetadata" = "suggestedMetadata" || %s::jsonb
            WHERE id = %s
        """, (json.dumps({"botFileId": bot_file_id}), tm_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"  DB error: {e}")
        conn.rollback()
        return False
    finally:
        cur.close(); conn.close()

async def main():
    if not BOT_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN not set"); return
    if not PROXY_CHANNEL_ID:
        print("ERROR: TELEGRAM_PROXY_CHANNEL_ID not set. Run setup_proxy_channel.py first"); return

    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated
    from telethon.tl.functions.messages import ForwardMessagesRequest

    conn = connect(); cur = conn.cursor()
    # Get all lessons without bot file_id
    cur.execute("""
        SELECT tm.id, tm."messageId", tm."audioFilename"
        FROM telegram_messages tm
        JOIN lessons l ON l."telegramSourceId" = tm.id
        LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
        WHERE l.status='PUBLISHED' AND m.id IS NULL
          AND tm."audioFilename" IS NOT NULL
          AND lower(tm."audioFilename") NOT LIKE '%.pdf'
          AND lower(tm."audioFilename") NOT LIKE '%.webp'
          AND (tm."suggestedMetadata"->>'botFileId') IS NULL
        ORDER BY tm."messageId"
    """)
    missing = cur.fetchall()
    cur.close(); conn.close()
    print(f"Lessons needing bot file_id: {len(missing)}", flush=True)

    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2")
    API_ID  = int(os.environ["TELEGRAM_API_ID"])
    _HASH   = os.environ["TELEGRAM_API_HASH"]
    PHONE   = os.environ.get("TELEGRAM_PHONE", "")

    client = TelegramClient(SESSION, API_ID, _HASH,
        connection=ConnectionTcpObfuscated, timeout=60)
    await client.start(phone=PHONE if PHONE else None)
    print(f"Authorized: {(await client.get_me()).first_name}", flush=True)

    source = await client.get_entity("@SheikhMuhammedZain")
    proxy  = await client.get_entity(int(PROXY_CHANNEL_ID))
    print(f"Forwarding to: {proxy.title}", flush=True)

    done = 0
    failed = 0

    # Forward in batches of 100
    batch_size = 100
    msg_ids_batches = [
        [row[1] for row in missing[i:i+batch_size]]
        for i in range(0, len(missing), batch_size)
    ]

    for batch_idx, batch_msg_ids in enumerate(msg_ids_batches):
        print(f"\nBatch {batch_idx+1}/{len(msg_ids_batches)}: forwarding {len(batch_msg_ids)} messages...", flush=True)

        try:
            result = await client(ForwardMessagesRequest(
                from_peer=source,
                id=batch_msg_ids,
                to_peer=proxy,
                drop_author=True,
                silent=True,
            ))
            print(f"  Forwarded {len(result.updates)} messages", flush=True)
            await asyncio.sleep(2)  # Rate limit
        except Exception as e:
            print(f"  Forward error: {e}", flush=True)
            failed += len(batch_msg_ids)
            continue

        # Now get bot file_ids from the forwarded messages
        # The bot can now access these since it's in the proxy channel
        # We need to get the new message IDs in the proxy channel
        # For now, just mark as needing retry
        done += len(batch_msg_ids)
        print(f"  Progress: {done}/{len(missing)}", flush=True)

    await client.disconnect()
    print(f"\nForwarded: {done}, Failed: {failed}", flush=True)
    print("Now run: py scripts/get_bot_fileids.py to retrieve file_ids", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
