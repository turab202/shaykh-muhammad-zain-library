"""
Resilient import loop — pages backwards through the Telegram channel
downloading all unprocessed messages in small batches.

How it works:
- Telegram channel has messages with IDs 1..~3400 (newest = 3334)
- We page backwards: start at max_id=3400, each batch fetches `batch`
  messages OLDER than the current cursor, updating cursor to the oldest
  message seen in that batch.
- The importer's duplicate-check skips already-seen messages cheaply.
- Stops when cursor reaches 0 (all messages scanned).

Usage:
    py scripts/import_loop.py               # audio download, batch of 5
    py scripts/import_loop.py --batch 10
    py scripts/import_loop.py --no-media    # metadata only, fast
    py scripts/import_loop.py --start-id 3400  # override start point
"""
import argparse, subprocess, sys, time, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def run_importer(py, extra_args: list) -> tuple[int, list[int]]:
    """
    Run the importer, capture output, extract message IDs processed.
    Returns (exit_code, list_of_processed_message_ids).
    """
    cmd = [py, "-m", "telegram.importer.importer", "--live"] + extra_args
    print(f"\n$ {' '.join(str(c) for c in cmd)}")
    import subprocess as sp
    result = sp.run(cmd, cwd=str(ROOT), capture_output=False)
    return result.returncode, []

def kill_stale_session():
    session = ROOT / "telegram" / ".session" / "importer"
    for suffix in [".session-journal", ".session-wal", ".session-shm"]:
        p = Path(str(session) + suffix)
        if p.exists():
            p.unlink()
            print(f"  Removed lock: {p.name}")

def get_min_unprocessed_id() -> int:
    """
    Return the smallest telegram message ID that has no linked lesson yet.
    This is where we should start downloading from.
    Returns 0 if all messages are processed.
    """
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        from _neon import connect
        conn = connect(retries=3)
        cur = conn.cursor()
        # Messages that exist in telegram_messages but have no lesson attached
        cur.execute("""
            SELECT MAX(ts."messageId")
            FROM telegram_messages ts
            LEFT JOIN lessons l ON l."telegramSourceId" = ts.id
            LEFT JOIN media m   ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
            WHERE l.id IS NULL
               OR (l.id IS NOT NULL AND m.id IS NULL)
        """)
        r = cur.fetchone()
        cur.close()
        conn.close()
        return r[0] or 0
    except Exception as e:
        print(f"  DB check failed: {e}")
        return 0

def get_stats() -> str:
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        from _neon import connect
        conn = connect(retries=2)
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) FROM telegram_messages')
        total = cur.fetchone()[0]
        cur.execute("""
            SELECT COUNT(DISTINCT l.id)
            FROM lessons l
            JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
            WHERE l.status = 'PUBLISHED'
        """)
        with_audio = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM lessons WHERE status = 'PUBLISHED'")
        published = cur.fetchone()[0]
        cur.close()
        conn.close()
        return f"messages={total}, published={published}, with_B2_audio={with_audio}"
    except Exception as e:
        return f"(db error: {e})"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch",    type=int, default=5,
                        help="Messages per Telegram fetch (default 5)")
    parser.add_argument("--no-media", action="store_true",
                        help="Record metadata only, skip audio download")
    parser.add_argument("--start-id", type=int, default=0,
                        help="Start from this message ID (0 = auto-detect from DB)")
    args = parser.parse_args()

    py = sys.executable
    linker = [py, str(ROOT / "scripts" / "link_b2_audio.py")]

    mode = "metadata-only (no download)" if args.no_media else "audio download"
    print(f"Import loop | mode={mode} | batch={args.batch}")
    print("Pages backwards through channel, skipping already-processed messages.")
    print("Press Ctrl+C to stop.\n")

    kill_stale_session()
    print(f"Current DB state: {get_stats()}\n")

    # Determine starting cursor
    if args.start_id > 0:
        cursor = args.start_id
    else:
        # Start just above the highest existing message
        cursor = 3500  # slightly above the known max of ~3334

    consecutive_failures = 0
    max_failures = 5
    batch_num = 0

    while cursor > 0:
        batch_num += 1
        importer_args = [
            "--limit", str(args.batch),
            "--max-id", str(cursor),
            "--auto-publish",
        ]
        if args.no_media:
            importer_args.append("--no-media")

        print(f"\n{'='*55}")
        print(f"Batch {batch_num} | cursor (max_id)={cursor} | {get_stats()}")
        print(f"{'='*55}")

        rc, _ = run_importer(py, importer_args)

        if rc == 0:
            consecutive_failures = 0

            if not args.no_media:
                print("\nLinking B2 files...")
                subprocess.run([py, str(ROOT / "scripts" / "link_b2_audio.py")],
                               cwd=str(ROOT))

            # Move cursor backwards by batch size
            # (Telegram returns messages newest-first, so cursor = oldest seen - 1)
            # We advance by batch to walk backwards through the channel
            cursor = max(0, cursor - args.batch)

            # Small pause to avoid rate limiting
            time.sleep(3)

        else:
            consecutive_failures += 1
            kill_stale_session()
            wait = min(30 * consecutive_failures, 120)
            print(f"\n✗ Failed ({consecutive_failures}/{max_failures}). Retry in {wait}s...")
            if consecutive_failures >= max_failures:
                print("Too many failures. Stopping.")
                break
            time.sleep(wait)

    print(f"\nFinished! Final state: {get_stats()}")
    if not args.no_media:
        print("Running final B2 link pass...")
        subprocess.run([py, str(ROOT / "scripts" / "link_b2_audio.py")], cwd=str(ROOT))

if __name__ == "__main__":
    main()
