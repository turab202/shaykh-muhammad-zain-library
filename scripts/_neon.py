"""Shared Neon connection helper — reads DATABASE_URL from .env"""
import os, psycopg2
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

def connect(timeout: int = 20):
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    # Strip unsupported params for psycopg2, keep sslmode
    if "channel_binding" in url:
        from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
        p = urlparse(url)
        qs = {k: v for k, v in parse_qs(p.query).items() if k in ("sslmode",)}
        url = urlunparse(p._replace(query=urlencode(qs, doseq=True)))
    return psycopg2.connect(url, connect_timeout=timeout)
