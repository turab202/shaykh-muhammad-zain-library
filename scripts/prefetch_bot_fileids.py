# -*- coding: utf-8 -*-
"""
Pre-fetch real Bot API file_ids for all proxy messages.
Stores them as telegramFileId in telegram_messages so the API
just calls getFile(fileId) directly — no forwarding needed = fast.
"""
import sys, os, asyncio, json, time, urllib.request, urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from _neon import connect

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ADMIN_CHAT = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "6669489997")
PROXY_CHANNEL_ID = os.environ["TELEGRAM_PROXY_CHANNEL_ID"]

def forward_and_get_file_id(proxy_msg_id: int) -> str | None:
    """Forward proxy message to admin chat, get file_id, delete forwarded msg."""
    data = json.dumps({
        'from_chat_id': PROXY_CHANNEL_ID,
        'message_id': proxy_msg_id,
        'chat_id': int(ADMIN_CHAT)
    }).encode()
    req = urllib.request.Request(
        f'https://api.telegram.org/bot{BOT_TOKEN}/forwardMessage',
        data=data, headers={'Content-Type': 'application/json'}, method='POST'
    )
    try:
        r = urllib.request.urlopen(req, timeout=15)
        result = json.loads(r.read())
        if not result.get('ok'):
            return None
        msg = result['result']
        file_id = (msg.get('audio') or msg.get('document') or msg.get('voice') or {}).get('file_id')
        fwd_msg_id = msg.get('message_id')
        # Delete the forwarded message
        if fwd_msg_id:
            del_data = json.dumps({'chat_id': int(ADMIN_CHAT), 'message_id': fwd_msg_id}).encode()
            del_req = urllib.request.Request(
                f'https://api.telegram.org/bot{BOT_TOKEN}/deleteMessage',
                data=del_data, headers={'Content-Type': 'application/json'}, method='POST'
            )
            try: urllib.request.urlopen(del_req, timeout=5)
            except: pass
        return file_id
    except Exception as e:
        print(f"    Error: {e}", flush=True)
        return None

def main():
    conn = connect(); cur = conn.cursor()

    # Get all lessons with proxy botFileId but no real telegramFileId
    cur.execute("""
        SELECT tm.id, tm."messageId",
               tm."suggestedMetadata"->>'botFileId' as proxy_ref,
               (tm."suggestedMetadata"->>'cachedFileId') as cached_id
        FROM telegram_messages tm
        JOIN lessons l ON l."telegramSourceId" = tm.id
        LEFT JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
        WHERE l.status='PUBLISHED' AND m.id IS NULL
          AND tm."suggestedMetadata"->>'botFileId' LIKE 'proxy:%'
          AND (tm."suggestedMetadata"->>'cachedFileId') IS NULL
        ORDER BY tm."messageId"
        LIMIT 100
    """)
    rows = cur.fetchall()
    print(f"Messages needing cached file_id: {len(rows)}", flush=True)

    cached = 0
    failed = 0

    for tm_id, msg_id, proxy_ref, _ in rows:
        # Parse proxy:-1003908725997:1432
        parts = proxy_ref.split(":")
        proxy_msg_id = int(parts[-1])

        print(f"  msgId={msg_id} proxy_msg={proxy_msg_id}...", end=" ", flush=True)
        file_id = forward_and_get_file_id(proxy_msg_id)

        if file_id:
            cur.execute("""
                UPDATE telegram_messages
                SET "suggestedMetadata" = "suggestedMetadata" || %s::jsonb
                WHERE id = %s
            """, (json.dumps({"cachedFileId": file_id}), tm_id))
            cached += 1
            print(f"✓ {file_id[:30]}", flush=True)
        else:
            failed += 1
            print(f"✗", flush=True)

        time.sleep(0.3)  # Rate limit

    conn.commit()
    cur.close(); conn.close()

    print(f"\nCached: {cached}, Failed: {failed}", flush=True)
    print("Run again to cache more batches of 100", flush=True)

if __name__ == "__main__":
    main()
