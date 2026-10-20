"""Test the new requests-based B2 upload."""
import sys, os, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from telegram.importer.storage import get_storage

storage = get_storage("B2")

# Create a tiny test file (5 bytes)
with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
    f.write(b"hello")
    tmp = f.name

try:
    key = storage.save(tmp, "test_upload_tiny.mp3", "audio/mpeg")
    print(f"SUCCESS! Key: {key}")
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
finally:
    os.unlink(tmp)
