"""Shared Neon connection helper — reads DATABASE_URL from .env"""
import os, time, psycopg2
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Only these params are supported by psycopg2
_ALLOWED_PARAMS = {"sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout"}

def _clean_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    if "?" in url:
        from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
        p = urlparse(url)
        qs = {k: v for k, v in parse_qs(p.query).items() if k in _ALLOWED_PARAMS}
        url = urlunparse(p._replace(query=urlencode(qs, doseq=True)))
    return url

def connect(timeout: int = 20, retries: int = 5):
    """Connect to Neon with automatic retry on transient SSL/network errors."""
    url = _clean_url()
    last_err = None
    for attempt in range(retries):
        try:
            return psycopg2.connect(url, connect_timeout=timeout)
        except psycopg2.OperationalError as e:
            last_err = e
            wait = min(2 ** attempt, 15)
            print(f"  Connection attempt {attempt+1}/{retries} failed: {e}")
            print(f"  Retrying in {wait}s...")
            time.sleep(wait)
    raise last_err
