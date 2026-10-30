"""Test B2 connectivity with different approaches."""
import os, sys, ssl, socket
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

import urllib3
urllib3.disable_warnings()

# Test 1: urllib3 direct PUT (bypasses boto3)
print("=== Test 1: urllib3 direct upload ===")
import urllib3
import hmac, hashlib, datetime, base64

endpoint = os.environ["B2_ENDPOINT"]
bucket = os.environ["B2_BUCKET_NAME"]
key_id = os.environ["B2_APPLICATION_KEY_ID"]
app_key = os.environ["B2_APPLICATION_KEY"]

http = urllib3.PoolManager(cert_reqs='CERT_NONE', assert_hostname=False)
url = f"https://{endpoint}/{bucket}/test/tiny.txt"

try:
    import boto3
    from botocore.config import Config
    REGION = endpoint.split(".")[1]
    s3 = boto3.client("s3",
        endpoint_url=f"https://{endpoint}",
        aws_access_key_id=key_id,
        aws_secret_access_key=app_key,
        region_name=REGION,
        verify=False,
        config=Config(signature_version="s3v4", connect_timeout=30, read_timeout=60),
    )
    # Try tiny upload
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as f:
        f.write(b"test")
        tmp = f.name
    s3.upload_file(tmp, bucket, "test/tiny.txt",
                   ExtraArgs={"ContentType": "text/plain"})
    os.unlink(tmp)
    print("SUCCESS! boto3 upload works!")
except Exception as e:
    print(f"boto3 failed: {type(e).__name__}: {e}")

# Test 2: Try via requests library
print("\n=== Test 2: requests library ===")
try:
    import requests
    from requests_aws4auth import AWS4Auth
    auth = AWS4Auth(key_id, app_key, REGION, 's3')
    r = requests.put(
        f"https://{endpoint}/{bucket}/test/tiny.txt",
        data=b"test",
        auth=auth,
        verify=False,
        timeout=30
    )
    print(f"requests result: {r.status_code}")
except ImportError:
    print("requests_aws4auth not installed, skipping")
except Exception as e:
    print(f"requests failed: {type(e).__name__}: {e}")

# Test 3: SSL context test
print("\n=== Test 3: Raw SSL test ===")
try:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with socket.create_connection((endpoint, 443), timeout=10) as sock:
        with ctx.wrap_socket(sock, server_hostname=endpoint) as ssock:
            print(f"SSL handshake OK! Protocol: {ssock.version()}")
            print(f"Cipher: {ssock.cipher()}")
except Exception as e:
    print(f"SSL failed: {e}")
