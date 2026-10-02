"""
Live Telegram connection test — controlled, read-only, single audio download.

What this script does:
  1. Connects to Telegram using credentials from .env
  2. Resolves @SheikhMuhammedZain
  3. Reads 5-10 recent messages
  4. Reports non-secret info: channel title, message IDs, dates, media types
  5. Downloads ONE audio file
  6. Verifies the download: size, MIME, duration if readable
  7. Prints a report — no secrets ever printed

What this script does NOT do:
  - It does NOT write anything to the database
  - It does NOT publish anything
  - It does NOT run the full import
  - It does NOT print API ID, API hash, phone number, OTP, or 2FA password

Usage:
  py telegram/tests/live_connection_test.py

Interactive auth: Telethon will prompt for phone/OTP/2FA in this terminal
if no session exists yet.
"""

import asyncio
import os
import sys
import tempfile
import mimetypes
from pathlib import Path
from datetime import datetime, timezone

# Load .env from project root
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

# ── Pre-flight credential check ──────────────────────────────────────────────
api_id_raw = os.getenv("TELEGRAM_API_ID")
api_hash = os.getenv("TELEGRAM_API_HASH")
channel = os.getenv("TELEGRAM_CHANNEL", "@SheikhMuhammedZain")
phone = os.getenv("TELEGRAM_PHONE")

missing = []
if not api_id_raw:
    missing.append("TELEGRAM_API_ID")
if not api_hash:
    missing.append("TELEGRAM_API_HASH")

if missing:
    print(f"\nERROR: Missing required environment variables: {', '.join(missing)}")
    print("Add them to your .env file. See telegram/.env.example.")
    sys.exit(1)

try:
    api_id = int(api_id_raw)
except ValueError:
    print("ERROR: TELEGRAM_API_ID must be a number.")
    sys.exit(1)

print(f"\n  TELEGRAM_API_ID  : SET ({len(api_id_raw)} chars)")
print(f"  TELEGRAM_API_HASH: SET ({len(api_hash)} chars)")
print(f"  TELEGRAM_CHANNEL : {channel}")
print(f"  TELEGRAM_PHONE   : {'SET' if phone else 'NOT SET — Telethon will prompt'}")
print()

# ── Session path (gitignored) ─────────────────────────────────────────────────
session_dir = Path(__file__).resolve().parent.parent / ".session"
session_dir.mkdir(parents=True, exist_ok=True)
session_path = str(session_dir / "importer")
print(f"  Session path: {session_path}.session")
print(f"  (gitignored — never committed)")
print()


# ── Helpers ───────────────────────────────────────────────────────────────────

def fmt_size(n: int) -> str:
    if n > 1_000_000:
        return f"{n/1_000_000:.1f} MB"
    if n > 1_000:
        return f"{n/1_000:.1f} KB"
    return f"{n} B"


def get_audio_duration(path: str):
    try:
        from mutagen import File as MutagenFile
        f = MutagenFile(path)
        if f and hasattr(f, "info") and hasattr(f.info, "length"):
            secs = int(f.info.length)
            return f"{secs // 60}m {secs % 60}s"
    except Exception:
        pass
    return "unknown"


# ── Main test ─────────────────────────────────────────────────────────────────

async def run_live_test():
    try:
        from telethon import TelegramClient
        from telethon.tl.types import (
            MessageMediaDocument, MessageMediaPhoto,
        )
    except ImportError:
        print("ERROR: telethon not installed. Run: py -m pip install telethon")
        sys.exit(1)

    # DC1 and DC2 are confirmed reachable; DC3/DC4 are blocked in this environment.
    # Force connection through DC2 to avoid hanging on blocked endpoints.
    client = TelegramClient(
        session_path,
        api_id,
        api_hash,
        connection_retries=5,
        timeout=30,
        request_retries=3,
        proxy=None,
    )
    # Override DC to DC2 (149.154.167.41:443) which is confirmed reachable
    client.session.set_dc(2, "149.154.167.41", 443)

    async with client:
        # Start — if phone is provided use it, otherwise Telethon prompts interactively
        if phone:
            await client.start(phone=lambda: phone)
        else:
            await client.start()  # will prompt for phone in terminal

        me = await client.get_me()
        print(f"  Authenticated as: {me.first_name} (id={me.id})")
        print()

        # ── Resolve channel ───────────────────────────────────────────────────
        print(f"  Resolving channel: {channel}")
        try:
            entity = await client.get_entity(channel)
        except Exception as e:
            print(f"  ERROR resolving {channel}: {e}")
            return

        chat_id = entity.id
        chat_title = getattr(entity, "title", channel)
        print(f"  Channel title : {chat_title}")
        print(f"  Channel ID    : {chat_id}")
        print()

        # ── Fetch 5-10 recent messages ────────────────────────────────────────
        print("  Fetching 10 recent messages...")
        print()
        messages = []
        audio_candidate = None

        async for msg in client.iter_messages(entity, limit=10):
            messages.append(msg)

            has_media = msg.media is not None
            media_desc = "no media"
            is_audio = False

            if has_media:
                # Detect media type without exposing file IDs
                if hasattr(msg.media, "document"):
                    doc = msg.media.document
                    mime = getattr(doc, "mime_type", "unknown")
                    size = getattr(doc, "size", 0)
                    # Get filename from attributes
                    fname = None
                    for attr in doc.attributes:
                        if hasattr(attr, "file_name") and attr.file_name:
                            fname = attr.file_name
                    if mime.startswith("audio/") or (fname and any(
                        fname.lower().endswith(ext) for ext in [".mp3", ".m4a", ".ogg", ".opus", ".wav"]
                    )):
                        is_audio = True
                        media_desc = f"AUDIO  mime={mime}  size={fmt_size(size)}"
                        if fname:
                            media_desc += f"  filename={fname}"
                        if audio_candidate is None:
                            audio_candidate = msg  # pick first audio found
                    elif mime == "application/pdf":
                        media_desc = f"PDF  size={fmt_size(size)}"
                        if fname:
                            media_desc += f"  filename={fname}"
                    else:
                        media_desc = f"document  mime={mime}  size={fmt_size(size)}"
                elif hasattr(msg.media, "photo"):
                    media_desc = "photo/image"
                else:
                    media_desc = f"media type: {type(msg.media).__name__}"

            caption_preview = ""
            text = msg.text or getattr(msg, "message", "") or ""
            if text:
                first_line = text.strip().split("\n")[0][:80]
                caption_preview = f"  caption: {first_line}"

            date_str = msg.date.strftime("%Y-%m-%d %H:%M UTC") if msg.date else "unknown"

            print(f"  msgId={msg.id:7}  date={date_str}  [{media_desc}]")
            if caption_preview:
                print(f"           {caption_preview}")

        print()
        print(f"  {len(messages)} messages retrieved from {chat_title}")
        print()

        # ── Download ONE audio file ───────────────────────────────────────────
        if audio_candidate is None:
            print("  No audio message found in the last 10 messages.")
            print("  The channel may use a different format — try increasing --limit when running full import.")
            return

        print(f"  Selected for download: msgId={audio_candidate.id}")
        print(f"  Downloading to temporary directory...")

        with tempfile.TemporaryDirectory() as tmpdir:
            downloaded = await client.download_media(audio_candidate, file=tmpdir)

            if not downloaded or not Path(downloaded).exists():
                print("  ERROR: Download failed — file does not exist after download.")
                return

            dl_path = Path(downloaded)
            size = dl_path.stat().st_size
            guessed_mime, _ = mimetypes.guess_type(str(dl_path))
            duration = get_audio_duration(str(dl_path))

            # Try to read first few bytes to verify file is readable
            readable = False
            try:
                with open(dl_path, "rb") as f:
                    header = f.read(16)
                    readable = len(header) > 0
            except Exception:
                pass

            print()
            print("  ┌─ DOWNLOAD VERIFIED ──────────────────────────────────────")
            print(f"  │  msgId    : {audio_candidate.id}")
            print(f"  │  filename : {dl_path.name}")
            print(f"  │  size     : {fmt_size(size)} ({size} bytes)")
            print(f"  │  MIME     : {guessed_mime or 'unknown'}")
            print(f"  │  duration : {duration}")
            print(f"  │  readable : {'YES' if readable else 'NO'}")
            print(f"  │  temp path: {dl_path}")
            print("  └──────────────────────────────────────────────────────────")
            print()

            if size == 0:
                print("  WARNING: File is 0 bytes — download may have failed.")
                return

            if not readable:
                print("  WARNING: File could not be read.")
                return

            print("  LIVE TEST PASSED:")
            print(f"    Account authenticated to Telegram")
            print(f"    Channel {chat_title} ({chat_id}) resolved successfully")
            print(f"    {len(messages)} real messages fetched")
            print(f"    1 real audio file downloaded and verified")
            print()
            print("  NEXT STEP:")
            print("    Run full import: py -m telegram.importer.importer --live --limit 100")
            print("    Then review imported records at: http://localhost:3000/en/admin/import")
            print()
            print("  NOTE: This test did NOT write to the database.")
            print("  NOTE: Downloaded file was in a temporary directory (auto-deleted).")

    print()
    print("  Live connection test complete.")


if __name__ == "__main__":
    asyncio.run(run_live_test())
