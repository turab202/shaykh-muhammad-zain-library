"""
Main Telegram importer — orchestrates the full pipeline:

  Telegram → Raw Archive Record → Metadata Extraction → Import Inbox

This module runs in two modes:

  1. LIVE mode  — connects to Telegram via Telethon and fetches real messages.
  2. OFFLINE mode — processes a JSON fixture file for testing without credentials.

In both modes the pipeline logic is identical:
  - raw source fields are preserved and never overwritten
  - deterministic parser runs first
  - every record goes into TelegramMessage (Import Inbox)
  - no content is automatically published

Usage:
  python -m telegram.importer.importer --offline fixtures/sample_messages.json
  python -m telegram.importer.importer --live --limit 50

Environment variables (see telegram/.env.example):
  DATABASE_URL, TELEGRAM_API_ID, TELEGRAM_API_HASH,
  TELEGRAM_PHONE, TELEGRAM_CHANNEL, STORAGE_PROVIDER, LOCAL_STORAGE_PATH
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from project root (one level above telegram/)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

from .parser import parse_caption, extract_links
from .database import ImportDB
from .storage import get_storage
from .media import (
    TelegramMediaDownloader,
    get_mime_type,
    get_media_type_enum,
    get_audio_duration_seconds,
    get_file_size,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


# ─── Shared pipeline logic ────────────────────────────────────────────────────

def process_one_message(
    *,
    db: ImportDB,
    storage,
    import_id: str,
    # Raw Telegram data
    chat_id: str,
    message_id: int,
    caption: Optional[str],
    date: datetime,
    audio_filename: Optional[str],
    telegram_file_id: Optional[str],
    telegram_file_unique_id: Optional[str],
    raw_json: dict,
    # Downloaded file (may be None for offline/no-media mode)
    downloaded_file_path: Optional[str] = None,
    dry_run: bool = False,
) -> dict:
    """
    Process one Telegram message through the full pipeline.
    Returns a summary dict with what happened.
    """
    result = {
        "message_id": message_id,
        "skipped": False,
        "skip_reason": None,
        "db_id": None,
        "media_stored": False,
        "storage_key": None,
        "confidence": 0.0,
        "suggested": {},
    }

    # 1. Duplicate check
    if db.message_exists(chat_id, message_id):
        log.info("  ↷ skip duplicate: chatId=%s messageId=%d", chat_id, message_id)
        result["skipped"] = True
        result["skip_reason"] = "duplicate"
        return result

    # 2. Deterministic metadata extraction
    suggested = parse_caption(caption, audio_filename)
    result["confidence"] = suggested.confidence
    result["suggested"] = suggested.to_dict()

    log.info(
        "  📋 messageId=%d confidence=%.2f series=%s lesson=%s",
        message_id, suggested.confidence,
        suggested.series_slug or "?",
        suggested.lesson_number or "?",
    )

    if dry_run:
        log.info("  [DRY RUN] would insert — skipping DB write")
        return result

    # 3. Insert raw TelegramMessage record (NEVER overwritten later)
    links = extract_links(caption)
    db_id = db.insert_raw_message(
        chat_id=chat_id,
        message_id=message_id,
        caption=caption,
        date=date,
        audio_filename=audio_filename,
        telegram_file_id=telegram_file_id,
        telegram_file_unique_id=telegram_file_unique_id,
        links=links,
        raw_json=raw_json,
        suggested_metadata=suggested.to_dict(),
        import_id=import_id,
    )
    result["db_id"] = db_id
    log.info("  ✓ inserted TelegramMessage id=%s", db_id)

    # 4. Store media file (if downloaded)
    if downloaded_file_path and os.path.exists(downloaded_file_path):
        filename = audio_filename or os.path.basename(downloaded_file_path)
        mime = get_mime_type(filename)
        media_type = get_media_type_enum(mime)
        size = get_file_size(downloaded_file_path)
        duration = get_audio_duration_seconds(downloaded_file_path)
        provider = os.getenv("STORAGE_PROVIDER", "LOCAL").upper()

        storage_key = storage.save(
            source_path=downloaded_file_path,
            original_filename=filename,
            mime_type=mime,
            message_date=date,
        )

        db.insert_media(
            filename=filename,
            mime_type=mime,
            size=size,
            duration_seconds=duration,
            media_type=media_type,
            storage_key=storage_key,
            storage_provider=provider,
        )

        # Update suggestedMetadata with media key so admin can see it
        meta_with_media = suggested.to_dict()
        meta_with_media["mediaStorageKey"] = storage_key
        meta_with_media["mediaFilename"] = filename
        db.update_suggested_metadata(db_id, meta_with_media)

        result["media_stored"] = True
        result["storage_key"] = storage_key
        log.info("  ✓ media stored: %s", storage_key)

    return result


# ─── OFFLINE mode ─────────────────────────────────────────────────────────────

def run_offline(fixture_path: str, database_url: str, storage_base: str, dry_run: bool = False):
    """
    Process a JSON fixture file (no Telegram connection needed).
    Used for testing and CI.

    Fixture format: list of message objects (see telegram/fixtures/)
    """
    log.info("=== OFFLINE MODE: %s ===", fixture_path)

    with open(fixture_path, encoding="utf-8") as f:
        messages: list[dict] = json.load(f)

    log.info("Loaded %d messages from fixture", len(messages))

    db = ImportDB(database_url)
    storage = get_storage(
        provider=os.getenv("STORAGE_PROVIDER", "LOCAL"),
        base_path=storage_base,
    )

    import_id = db.create_import()
    log.info("Created import job: %s", import_id)

    results = []
    errors = 0

    for msg in messages:
        try:
            date_raw = msg.get("date", "2024-01-01T00:00:00Z")
            if isinstance(date_raw, str):
                date = datetime.fromisoformat(date_raw.replace("Z", "+00:00"))
            else:
                date = datetime.fromtimestamp(date_raw, tz=timezone.utc)

            # In offline mode, media_file may be a local path for testing
            downloaded_path = msg.get("_test_media_path")

            r = process_one_message(
                db=db,
                storage=storage,
                import_id=import_id,
                chat_id=str(msg["chat_id"]),
                message_id=int(msg["message_id"]),
                caption=msg.get("caption") or msg.get("text"),
                date=date,
                audio_filename=msg.get("audio_filename"),
                telegram_file_id=msg.get("telegram_file_id"),
                telegram_file_unique_id=msg.get("telegram_file_unique_id"),
                raw_json=msg,
                downloaded_file_path=downloaded_path,
                dry_run=dry_run,
            )
            results.append(r)
        except Exception as exc:
            log.error("Error processing messageId=%s: %s", msg.get("message_id"), exc)
            errors += 1

    db.finish_import(import_id, status="DONE" if errors == 0 else "FAILED")

    # Print summary
    inserted = sum(1 for r in results if r.get("db_id"))
    skipped = sum(1 for r in results if r.get("skipped"))
    with_media = sum(1 for r in results if r.get("media_stored"))
    high_conf = sum(1 for r in results if r.get("confidence", 0) >= 0.7)
    needs_review = sum(1 for r in results if r.get("confidence", 0) < 0.5 and not r.get("skipped"))

    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"  Total processed : {len(messages)}")
    print(f"  Inserted        : {inserted}")
    print(f"  Skipped (dup)   : {skipped}")
    print(f"  With media      : {with_media}")
    print(f"  High confidence : {high_conf}")
    print(f"  Needs review    : {needs_review}")
    print(f"  Errors          : {errors}")
    print(f"  Import ID       : {import_id}")
    print("=" * 60)

    for r in results:
        if not r.get("skipped"):
            s = r.get("suggested", {})
            print(
                f"  msg#{r['message_id']:>5}  conf={r['confidence']:.2f}"
                f"  series={s.get('series_slug') or '—':30}"
                f"  lesson={str(s.get('lesson_number') or '—'):>5}"
                f"  title={str(s.get('title') or '—')[:40]}"
            )

    db.close()
    return results


# ─── LIVE mode ────────────────────────────────────────────────────────────────

async def run_live(
    api_id: int,
    api_hash: str,
    phone: str,
    channel: str,
    database_url: str,
    storage_base: str,
    limit: int = 100,
    min_message_id: int = 0,
    dry_run: bool = False,
):
    """
    Connect to Telegram via Telethon and import real messages.
    Requires valid TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE.
    """
    try:
        from telethon import TelegramClient
        from telethon.tl.types import MessageMediaDocument, MessageMediaAudio
    except ImportError:
        log.error("telethon is not installed. Run: pip install telethon")
        sys.exit(1)

    session_path = str(_PROJECT_ROOT / "telegram" / ".session" / "importer")
    Path(session_path).parent.mkdir(parents=True, exist_ok=True)

    log.info("=== LIVE MODE: channel=%s limit=%d ===", channel, limit)

    db = ImportDB(database_url)
    storage = get_storage(provider=os.getenv("STORAGE_PROVIDER", "LOCAL"), base_path=storage_base)
    downloader_client = None

    client = TelegramClient(
        session_path,
        api_id,
        api_hash,
        connection_retries=5,
        timeout=30,
        request_retries=3,
    )
    # DC2 is confirmed reachable — use it to avoid blocked DC3/DC4
    client.session.set_dc(2, "149.154.167.41", 443)

    async with client:
        await client.start(phone=phone)
        entity = await client.get_entity(channel)
        chat_id = str(entity.id)

        log.info("Connected. Channel: %s (id=%s)", channel, chat_id)

        import_id = db.create_import()
        log.info("Created import job: %s", import_id)

        downloader = TelegramMediaDownloader(client)
        results = []
        errors = 0

        async for message in client.iter_messages(entity, limit=limit, min_id=min_message_id):
            try:
                # Extract audio filename from Telegram media attributes
                audio_filename = None
                telegram_file_id = None
                telegram_file_unique_id = None
                downloaded_path = None

                if message.media and hasattr(message.media, "document"):
                    doc = message.media.document
                    telegram_file_id = str(doc.id)
                    telegram_file_unique_id = getattr(doc, "file_unique_id", None) or str(doc.access_hash)
                    for attr in doc.attributes:
                        if hasattr(attr, "file_name") and attr.file_name:
                            audio_filename = attr.file_name
                            break

                    # Download media
                    with tempfile.TemporaryDirectory() as tmpdir:
                        temp_dest = os.path.join(tmpdir, audio_filename or "media")
                        downloaded = await client.download_media(message, file=temp_dest)
                        if downloaded and os.path.exists(downloaded):
                            downloaded_path = downloaded
                            r = process_one_message(
                                db=db, storage=storage, import_id=import_id,
                                chat_id=chat_id,
                                message_id=message.id,
                                caption=message.text or getattr(message, "caption", None),
                                date=message.date,
                                audio_filename=audio_filename,
                                telegram_file_id=telegram_file_id,
                                telegram_file_unique_id=telegram_file_unique_id,
                                raw_json=message.to_dict(),
                                downloaded_file_path=downloaded_path,
                                dry_run=dry_run,
                            )
                        else:
                            # No media downloaded — still insert the raw record
                            r = process_one_message(
                                db=db, storage=storage, import_id=import_id,
                                chat_id=chat_id, message_id=message.id,
                                caption=message.text or getattr(message, "caption", None),
                                date=message.date,
                                audio_filename=audio_filename,
                                telegram_file_id=telegram_file_id,
                                telegram_file_unique_id=telegram_file_unique_id,
                                raw_json=message.to_dict(),
                                dry_run=dry_run,
                            )
                else:
                    # Text-only message — no media
                    if not (message.text or getattr(message, "caption", None)):
                        continue
                    r = process_one_message(
                        db=db, storage=storage, import_id=import_id,
                        chat_id=chat_id, message_id=message.id,
                        caption=message.text,
                        date=message.date,
                        audio_filename=None,
                        telegram_file_id=None,
                        telegram_file_unique_id=None,
                        raw_json=message.to_dict(),
                        dry_run=dry_run,
                    )

                results.append(r)

            except Exception as exc:
                log.error("Error on messageId=%d: %s", message.id, exc)
                errors += 1

        db.finish_import(import_id, status="DONE" if errors == 0 else "FAILED")
        log.info("Import complete. %d processed, %d errors.", len(results), errors)
        db.close()
        return results


# ─── CLI entry point ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Shaykh Muhammad Zain Library — Telegram Importer"
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--offline", metavar="FIXTURE", help="Path to JSON fixture file (no Telegram connection)")
    mode.add_argument("--live", action="store_true", help="Connect to live Telegram channel")

    parser.add_argument("--limit", type=int, default=100, help="Max messages to fetch (live mode)")
    parser.add_argument("--min-id", type=int, default=0, help="Only fetch messages with ID > this (live mode, for resuming)")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, do not write to DB")
    args = parser.parse_args()

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    storage_base = os.getenv("LOCAL_STORAGE_PATH", "./storage")

    if args.offline:
        run_offline(
            fixture_path=args.offline,
            database_url=database_url,
            storage_base=storage_base,
            dry_run=args.dry_run,
        )
    elif args.live:
        api_id = os.getenv("TELEGRAM_API_ID")
        api_hash = os.getenv("TELEGRAM_API_HASH")
        phone = os.getenv("TELEGRAM_PHONE")
        channel = os.getenv("TELEGRAM_CHANNEL")

        missing = [k for k, v in {"TELEGRAM_API_ID": api_id, "TELEGRAM_API_HASH": api_hash,
                                    "TELEGRAM_PHONE": phone, "TELEGRAM_CHANNEL": channel}.items() if not v]
        if missing:
            print(f"ERROR: Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
            print("See telegram/.env.example for all required variables.", file=sys.stderr)
            sys.exit(1)

        asyncio.run(run_live(
            api_id=int(api_id),
            api_hash=api_hash,
            phone=phone,
            channel=channel,
            database_url=database_url,
            storage_base=storage_base,
            limit=args.limit,
            min_message_id=args.min_id,
            dry_run=args.dry_run,
        ))


if __name__ == "__main__":
    main()
