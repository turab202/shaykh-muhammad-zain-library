"""Test if archive.org upload works from this machine."""
import os, sys, tempfile, requests
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

IA_ACCESS = os.environ.get("IA_ACCESS_KEY", "")
IA_SECRET = os.environ.get("IA_SECRET_KEY", "")

if not IA_ACCESS:
    print("No IA_ACCESS_KEY in .env")
    sys.exit(1)

from requests_aws4auth import AWS4Auth
import urllib3
urllib3.disable_warnings()

# Create tiny test file
with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
    f.write(b"hello world test audio" * 100)
    tmp = f.name

import urllib.parse
safe_fn = urllib.parse.quote("test_tiny.mp3", safe=".-_")
url = f"https://s3.us.archive.org/shaykh-muhammad-zain-test/{safe_fn}"

auth = AWS4Auth(IA_ACCESS, IA_SECRET, "us", "s3")
headers = {
    "x-archive-auto-make-bucket": "1",
    "x-archive-meta-title": "Test Upload",
    "x-archive-meta-mediatype": "audio",
    "x-archive-meta-collection": "opensource_audio",
    "Content-Type": "audio/mpeg",
}

print(f"Testing upload to archive.org...")
try:
    r = requests.put(url, data=open(tmp,'rb'), auth=auth,
                     headers=headers, verify=False, timeout=(10, 30))
    print(f"Result: HTTP {r.status_code}")
    if r.status_code in (200, 201):
        print("SUCCESS! archive.org uploads work from this machine!")
    else:
        print(f"Failed: {r.text[:200]}")
except Exception as e:
    print(f"Connection error: {type(e).__name__}: {e}")
finally:
    os.unlink(tmp)
