"""
Resilient import loop — pages backwards through the Telegram channel.

How it works:
- Starts at the highest message ID in the channel (~3334)
- Each batch fetches `batch` messages OLDER than the current cursor
- cursor moves backward by `batch` each time
- Skips duplicates, so already-processed messages cost only a DB lookup
- Stops when cursor reaches 0

Usage:
    py scripts/import_loop.py --no-media --batch 20   # metadata only (fast)
    py scripts/import_loop.py --batch 3               # download audio (slow)
    py scripts/import_loop.py --start-id 1500         # resume from ID 1500
"""
import argparse, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def kill_stale_session():
    """Remove Telethon SQLite lock files — silently skip if locked by another process."""
    session = ROOT / "telegram" / ".session" / "importer"
    for suffix in [".session-journal", ".session-wal", ".session-shm"]:
        p = Path(str(session) + suffix)
        if p.exists():
            try:
                p.unlink()
                print(f"  Removed lock: {p.name}")
            except PermissionError:
                print(f"  Warning: {p.name} is locked by another process.")
                print("  Please close the other Python/import process first.")
            except Exception as e:
                print(f"  Could not remove {p.name}: {e}")

def get_max_channel_message_id() -> int:
    """Get highest messageId from telegram_messages table."""
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        from _neon import connect
        conn = connect(retries=3)
        cur = conn.cursor()
        cur.execute('SELECT MAX("messageId") FROM telegram_messages')
        r = cur.fetchone()
        cur.close()
        conn.close()
        return (r[0] or 0) + 1  # +1 so we include the max message itself
    except Exception as e:
        print(f"  DB error getting max ID: {e}")
        return 3335  # fallback: known channel max

def get_stats() -> str:
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        from _neon import connect
        conn = connect(retries=2)
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) FROM telegram_messages')
        msgs = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM lessons WHERE status='PUBLISHED'")
        pub = cur.fetchone()[0]
        cur.execute("""
            SELECT COUNT(DISTINCT l.id) FROM lessons l
            JOIN media m ON m."lessonId"=l.id AND m."mediaType"='AUDIO'
            WHERE l.status='PUBLISHED'
        """)
        audio = cur.fetchone()[0]
        cur.close()
        conn.close()
        return f"messages={msgs} | published={pub} | with_audio={audio}"
    except Exception as e:
        return f"(db: {e})"

def run(cmd: list) -> int:
    print(f"\n$ {' '.join(str(c) for c in cmd)}")
    return subprocess.run(cmd, cwd=str(ROOT)).returncode

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch",    type=int, default=20,
                        help="Messages per fetch (default 20)")
    parser.add_argument("--no-media", action="store_true",
                        help="Metadata only, no audio download")
    parser.add_argument("--start-id", type=int, default=0,
                        help="Start cursor (0 = auto from DB)")
    args = parser.parse_args()

    py = sys.executable
    linker = [py, str(ROOT / "scripts" / "link_b2_audio.py")]

    mode = "no-media (metadata only)" if args.no_media else "AUDIO DOWNLOAD"
    print(f"\nImport loop | mode={mode} | batch={args.batch}")
    print("Pages backwards: newest → oldest message")
    print("Press Ctrl+C to stop.\n")

    kill_stale_session()

    # Cursor = next message ID to fetch below
    # Use start-id override or auto-detect from DB
    if args.start_id > 0:
        cursor = args.start_id
    else:
        cursor = get_max_channel_message_id()

    print(f"Starting cursor: {cursor}")
    print(f"Current state  : {get_stats()}\n")

    consecutive_failures = 0
    max_failures = 5
    batch_num = 0

    while cursor > 0:
        batch_num += 1

        base_cmd = [
            py, "-m", "telegram.importer.importer",
            "--live",
            "--limit", str(args.batch),
            "--max-id", str(cursor),
            "--auto-publish",
        ]
        if args.no_media:
            base_cmd.append("--no-media")

        print(f"\n{'='*55}")
        print(f"Batch {batch_num} | cursor={cursor} | {get_stats()}")
        print(f"{'='*55}")

        rc = run(base_cmd)

        if rc == 0:
            consecutive_failures = 0
            if not args.no_media:
                print("\nLinking B2 files...")
                run(linker)
                # Fix any wrong Content-Types
                run([py, str(ROOT / "scripts" / "fix_b2_content_types.py")])
            # Move cursor backward by batch size
            cursor = max(0, cursor - args.batch)
            # Wait to let Telethon fully release the SQLite session lock
            time.sleep(8)
        else:
            consecutive_failures += 1
            kill_stale_session()
            wait = min(30 * consecutive_failures, 120)
            print(f"\n✗ Failed ({consecutive_failures}/{max_failures}). Retry in {wait}s...")
            if consecutive_failures >= max_failures:
                print("Too many failures. Stopping.")
                break
            time.sleep(wait)

    print(f"\nDone! Final: {get_stats()}")
    if not args.no_media:
        run(linker)

if __name__ == "__main__":
    main()
