# -*- coding: utf-8 -*-
"""
Map proxy channel messages to original messages by document ID.
Since we forwarded in order, doc.id is the same in both channels.
"""
import sys, os, asyncio, json
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

    SESSION = str(Path(__file__).parent.parent / "telegram" / ".session" / "importer2")
    client = TelegramClient(SESSION, int(os.environ["TELEGRAM_API_ID"]),
        os.environ["TELEGRAM_API_HASH"], connection=ConnectionTcpObfuscated, timeout=60)
    await client.start()
    print(f"Authorized: {(await client.get_me()).first_name}", flush=True)

    source  = await client.get_entity("@SheikhMuhammedZain")
    proxy   = await client.get_entity(int(PROXY_CHANNEL_ID))

    # Build map: doc_id → proxy_msg_id
    print("Reading proxy channel...", flush=True)
    doc_to_proxy_id = {}
    async for msg in client.iter_messages(proxy, limit=None):
        if msg.document:
            doc_to_proxy_id[msg.document.id] = msg.id
        elif msg.audio:
            doc_to_proxy_id[msg.audio.id] = msg.id
    print(f"  Found {len(doc_to_proxy_id)} docs in proxy", flush=True)

    # Read source channel original messages and match by doc_id
    conn = connect(); cur = conn.cursor()
    cur.execute("""
        SELECT tm.id, tm."messageId", tm."audioFilename"
        FROM telegram_messages tm
        JOIN lessons l ON l."telegramSourceId" = tm.id
        LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
        WHERE l.status='PUBLISHED' AND m.id IS NULL
          AND tm."audioFilename" IS NOT NULL
          AND lower(tm."audioFilename") NOT LIKE '%.pdf'
          AND lower(tm."audioFilename") NOT LIKE '%.webp'
    """)
    missing = cur.fetchall()
    print(f"Lessons needing bot_file_id: {len(missing)}", flush=True)

    # Get source messages to find doc_ids
    source_msg_ids = [row[1] for row in missing]
    tm_by_msg_id   = {row[1]: row[0] for row in missing}

    print("Reading source channel to get doc_ids...", flush=True)
    saved = 0
    chunk = 100

    for i in range(0, len(source_msg_ids), chunk):
        batch = source_msg_ids[i:i+chunk]
        try:
            msgs = await client.get_messages(source, ids=batch)
        except Exception as e:
            print(f"  Error: {e}"); continue

        updates = []
        for msg in msgs:
            if not msg: continue
            doc_id = None
            if msg.document: doc_id = msg.document.id
            elif msg.audio:  doc_id = msg.audio.id
            if not doc_id: continue

            proxy_msg_id = doc_to_proxy_id.get(doc_id)
            if proxy_msg_id:
                tm_id = tm_by_msg_id.get(msg.id)
                if tm_id:
                    bot_ref = f"proxy:{PROXY_CHANNEL_ID}:{proxy_msg_id}"
                    updates.append((json.dumps({"botFileId": bot_ref}), tm_id))
                    saved += 1

        if updates:
            cur.executemany("""
                UPDATE telegram_messages
                SET "suggestedMetadata" = COALESCE("suggestedMetadata",'{}') || %s::jsonb
                WHERE id=%s
            """, updates)
            conn.commit()

        print(f"  {i+len(batch)}/{len(source_msg_ids)} processed, {saved} mapped", flush=True)

    print(f"\nTotal mapped: {saved}/{len(missing)}", flush=True)
    cur.close(); conn.close()
    await client.disconnect()
    print("Done!", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
