"""
Resilient import loop — runs the Telegram importer in small batches,
retrying on network/DB failures, until it has processed all messages
or hit the target count.

Usage:
    py scripts/import_loop.py              # import all, batches of 5
    py scripts/import_loop.py --batch 10  # larger batches
    py scripts/import_loop.py --max 50    # stop after 50 new messages
    py scripts/import_loop.py --no-media  # metadata only, no download

After each successful batch it runs link_b2_audio.py to link any
newly-uploaded files to their lessons.
"""
import argparse, subprocess, sys, time, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def run(cmd: list[str], cwd=ROOT) -> int:
    """Run a command, stream output, return exit code."""
    print(f"\n$ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(cwd))
    return result.returncode

def get_max_message_id() -> int:
    """Return the highest messageId already in telegram_messages."""
    sys.path.insert(0, str(ROOT / "scripts"))
    from _neon import connect
    conn = connect()
    cur = conn.cursor()
    cur.execute('SELECT MAX("messageId") FROM telegram_messages')
    r = cur.fetchone()
    cur.close()
    conn.close()
    return r[0] or 0

def count_pending() -> int:
    """Count messages in telegram_messages that have no linked lesson yet."""
    sys.path.insert(0, str(ROOT / "scripts"))
    from _neon import connect
    conn = connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT COUNT(*) FROM telegram_messages ts
        LEFT JOIN lessons l ON l."telegramSourceId" = ts.id
        WHERE l.id IS NULL
    """)
    r = cur.fetchone()
    cur.close()
    conn.close()
    return r[0] or 0

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch",    type=int, default=5,   help="Messages per batch (default 5)")
    parser.add_argument("--max",      type=int, default=9999, help="Stop after this many total new messages")
    parser.add_argument("--no-media", action="store_true",   help="Skip audio download (metadata only)")
    parser.add_argument("--min-id",   type=int, default=0,   help="Override min message ID (0 = auto)")
    args = parser.parse_args()

    py = sys.executable
    importer = [py, "-m", "telegram.importer.importer", "--live",
                "--limit", str(args.batch), "--auto-publish"]
    if args.no_media:
        importer.append("--no-media")

    linker = [py, str(ROOT / "scripts" / "link_b2_audio.py")]

    total_imported = 0
    consecutive_failures = 0
    max_failures = 5

    print(f"Starting import loop: batch={args.batch}, max={args.max}, no_media={args.no_media}")
    print("Press Ctrl+C to stop.\n")

    while total_imported < args.max:
        # For --no-media runs, always start from 0 and let duplicate-check skip seen messages.
        # For media runs, use the max seen ID to avoid re-downloading files.
        if args.min_id:
            min_id = args.min_id
        elif args.no_media:
            min_id = 0  # duplicate check handles already-seen messages cheaply
        else:
            try:
                min_id = get_max_message_id()
            except Exception as e:
                print(f"  Could not get max message ID: {e}")
                min_id = 0

        batch_cmd = importer + ["--min-id", str(min_id)]
        print(f"\n{'='*60}")
        print(f"Batch {total_imported//args.batch + 1} | min_id={min_id} | imported_so_far={total_imported}")
        print(f"{'='*60}")

        rc = run(batch_cmd)

        if rc == 0:
            consecutive_failures = 0
            total_imported += args.batch
            print(f"\n✓ Batch done. Linking B2 files...")
            if not args.no_media:
                run(linker)
            # Small pause between batches to avoid hammering connections
            print("Waiting 5s before next batch...")
            time.sleep(5)
        else:
            consecutive_failures += 1
            wait = min(30 * consecutive_failures, 120)
            print(f"\n✗ Batch failed (attempt {consecutive_failures}/{max_failures}). Retrying in {wait}s...")
            if consecutive_failures >= max_failures:
                print(f"Too many consecutive failures ({max_failures}). Stopping.")
                break
            time.sleep(wait)

    print(f"\nLoop finished. Total messages attempted: {total_imported}")

if __name__ == "__main__":
    main()
