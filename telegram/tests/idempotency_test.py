"""
Idempotency test: re-run the same 20-message import batch and verify
no new rows are created for the real channel (chatId=1747155048).

Usage:
    py telegram/tests/idempotency_test.py
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT / ".env")

import psycopg2

REAL_CHAT_ID = "1747155048"


def count_real_rows(conn) -> int:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM telegram_messages WHERE "chatId" = %s',
            (REAL_CHAT_ID,),
        )
        return cur.fetchone()[0]


async def main():
    from telethon import TelegramClient
    from telethon.network import ConnectionTcpObfuscated

    db_url = os.environ["DATABASE_URL"].split("?")[0]
    conn = psycopg2.connect(db_url)

    before = count_real_rows(conn)
    print(f"Rows before second import: {before}")

    # Re-run the same batch (limit=20, no_media=True)
    sys.path.insert(0, str(ROOT))
    from telegram.importer.importer import run_live

    api_id   = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    phone    = os.environ["TELEGRAM_PHONE"]
    channel  = os.environ["TELEGRAM_CHANNEL"]
    db_url_full = os.environ["DATABASE_URL"]
    storage  = os.environ.get("LOCAL_STORAGE_PATH", "./storage")

    results = await run_live(
        api_id=api_id,
        api_hash=api_hash,
        phone=phone,
        channel=channel,
        database_url=db_url_full,
        storage_base=storage,
        limit=20,
        no_media=True,
    )

    after = count_real_rows(conn)
    print(f"Rows after  second import: {after}")

    inserted = [r for r in results if not r.get("skipped")]
    skipped  = [r for r in results if r.get("skipped")]

    print(f"\nResults from second run:")
    print(f"  Processed : {len(results)}")
    print(f"  Inserted  : {len(inserted)}")
    print(f"  Skipped   : {len(skipped)}")
    print(f"  New rows  : {after - before}")

    if after - before == 0:
        print("\n✓ IDEMPOTENCY CONFIRMED — no duplicates created")
    else:
        print(f"\n✗ IDEMPOTENCY FAILED — {after - before} unexpected new rows!")

    conn.close()


if __name__ == "__main__":
    asyncio.run(main())
