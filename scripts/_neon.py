"""Shared Neon connection helper — reads DATABASE_URL from .env"""
import os, psycopg2
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Only these params are supported by psycopg2
_ALLOWED_PARAMS = {"sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout"}

def connect(timeout: int = 20):
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    # Strip ALL unsupported query params — psycopg2 only understands standard PG params
    if "?" in url:
        from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
        p = urlparse(url)
        qs = {k: v for k, v in parse_qs(p.query).items() if k in _ALLOWED_PARAMS}
        url = urlunparse(p._replace(query=urlencode(qs, doseq=True)))
    return psycopg2.connect(url, connect_timeout=timeout)
