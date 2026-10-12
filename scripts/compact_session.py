"""
Create a compact copy of the Telethon session for GitHub Actions.
Strips the entity cache (which inflates the file) keeping only auth data.
"""
import sqlite3, shutil, os, base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src  = ROOT / "telegram" / ".session" / "importer.session"
dest = ROOT / "telegram" / ".session" / "importer-compact.session"

if not src.exists():
    print(f"Session not found: {src}")
    raise SystemExit(1)

# Copy to compact file
shutil.copy2(src, dest)

# Connect and delete entity cache to shrink it
conn = sqlite3.connect(str(dest))
cur  = conn.cursor()

# Show tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables: {tables}")

# Delete entities (channel/user cache) — not needed for auth
for table in ['entities', 'sent_files', 'update_state']:
    if table in tables:
        cur.execute(f"DELETE FROM {table}")
        print(f"  Cleared {table}: {cur.rowcount} rows")

conn.commit()

# Vacuum to reclaim space
conn.execute("VACUUM")
conn.close()

# Check sizes
orig_kb    = src.stat().st_size // 1024
compact_kb = dest.stat().st_size // 1024
print(f"\nOriginal : {orig_kb} KB")
print(f"Compact  : {compact_kb} KB")
print(f"Limit    : 64 KB")

if compact_kb > 64:
    print(f"\n⚠ Still too large ({compact_kb} KB > 64 KB)")
    print("Try deleting the session and re-authenticating to get a fresh small file.")
else:
    # Output base64
    data = dest.read_bytes()
    b64  = base64.b64encode(data).decode()
    b64_kb = len(b64) // 1024
    print(f"Base64 size: {b64_kb} KB")

    if b64_kb <= 64:
        print(f"\n✓ Ready for GitHub Actions!")
        print(f"\nAdd this as TELEGRAM_SESSION_BASE64 secret (copy everything between the lines):")
        print("=" * 60)
        print(b64)
        print("=" * 60)
        # Also save to a file for easy copy
        out = ROOT / "telegram" / ".session" / "session_base64.txt"
        out.write_text(b64)
        print(f"\nAlso saved to: {out}")
    else:
        print(f"\n⚠ Base64 still {b64_kb} KB — need a fresh session")
        print("Delete the session file and re-run telegram_auth.py to create a fresh one")
