"""
Storage abstraction for downloaded Telegram media.

Supports:
  - LOCAL: saves files under LOCAL_STORAGE_PATH (default: ./storage/)
  - R2:    uploads to Cloudflare R2 (S3-compatible)
  - B2:    uploads to Backblaze B2 (S3-compatible)

The storage key is saved in Media.storageKey.
For LOCAL: relative path  → served via /api/media/{key}
For R2/B2: full HTTPS URL → served directly from CDN (public)
           or b2://bucket/key → signed URL via Next.js API (private)
"""

import os
import re
import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional


def _safe_filename(name: str) -> str:
    name = re.sub(r"[^\w.\-]", "_", name)
    name = re.sub(r"_+", "_", name)
    return name[:180]


def _media_subdir(mime_type: str) -> str:
    if mime_type.startswith("audio/"):
        return "audio"
    if mime_type == "application/pdf":
        return "pdf"
    if mime_type.startswith("image/"):
        return "image"
    return "document"


def _object_key(original_filename: str, mime_type: str,
                message_date: Optional[datetime] = None) -> str:
    year = (message_date or datetime.utcnow()).year
    subdir = _media_subdir(mime_type)
    safe = _safe_filename(original_filename)
    h = hashlib.md5(original_filename.encode()).hexdigest()[:8]
    stem, ext = os.path.splitext(safe)
    return f"{subdir}/{year}/{stem}_{h}{ext}"


# ── Local ─────────────────────────────────────────────────────────────────────

class LocalStorage:
    def __init__(self, base_path: str):
        self.base = Path(base_path)
        self.base.mkdir(parents=True, exist_ok=True)

    def save(self, source_path: str, original_filename: str, mime_type: str,
             message_date: Optional[datetime] = None) -> str:
        key = _object_key(original_filename, mime_type, message_date)
        dest = self.base / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(source_path, dest)
        return key  # relative key → served via /api/media/{key}

    def url_for(self, storage_key: str) -> str:
        return str(self.base / storage_key)

    def exists(self, storage_key: str) -> bool:
        return (self.base / storage_key).exists()


# ── S3-compatible (R2 / B2) ───────────────────────────────────────────────────

class S3Storage:
    """Generic S3-compatible storage (Cloudflare R2 or Backblaze B2)."""

    def __init__(
        self,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str,
        public_url: str = "",  # CDN/public URL prefix — leave empty for private
    ):
        self.bucket = bucket_name
        self.public_url = public_url.rstrip("/")
        self._endpoint_url = endpoint_url

        try:
            import boto3
            from botocore.config import Config
            # B2 requires the real region derived from the endpoint hostname
            # e.g. "s3.us-east-005.backblazeb2.com" → "us-east-005"
            region = "auto"
            if endpoint_url:
                host = endpoint_url.replace("https://", "").replace("http://", "")
                parts = host.split(".")
                if len(parts) >= 2:
                    region = parts[1]  # "us-east-005"
            self._s3 = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                region_name=region,
                config=Config(signature_version="s3v4"),
            )
        except ImportError:
            raise ImportError("boto3 is required for cloud storage. Run: pip install boto3")

    def save(self, source_path: str, original_filename: str, mime_type: str,
             message_date: Optional[datetime] = None) -> str:
        import logging
        from boto3.s3.transfer import TransferConfig
        log = logging.getLogger(__name__)
        key = _object_key(original_filename, mime_type, message_date)
        size_kb = os.path.getsize(source_path) // 1024
        log.info("  ☁ Uploading to B2: %s (%s KB)", key, size_kb)
        # Use single-part upload for files under 100MB to avoid multipart timeouts
        config = TransferConfig(
            multipart_threshold=100 * 1024 * 1024,
            max_concurrency=1,
        )
        self._s3.upload_file(
            source_path, self.bucket, key,
            ExtraArgs={"ContentType": mime_type, "CacheControl": "public, max-age=31536000"},
            Config=config,
        )
        log.info("  ✓ Uploaded to B2: %s", key)
        if self.public_url:
            return f"{self.public_url}/{key}"
        return f"s3://{self.bucket}/{key}"

    def get_presigned_url(self, storage_key: str, expires: int = 3600) -> str:
        """Generate a time-limited download URL for private bucket access."""
        if storage_key.startswith("http"):
            return storage_key
        key = storage_key.split("/", 3)[-1]  # strip s3://bucket/
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires,
        )

    def exists(self, storage_key: str) -> bool:
        key = storage_key.split("/", 3)[-1] if storage_key.startswith("s3://") else storage_key
        try:
            self._s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False


# ── Factory ───────────────────────────────────────────────────────────────────

def get_storage(provider: str = "LOCAL", base_path: str = "./storage"):
    """Return the configured storage backend."""
    p = (provider or "LOCAL").upper()

    if p == "R2":
        return S3Storage(
            endpoint_url      = f"https://{os.environ.get('R2_ACCOUNT_ID','')}.r2.cloudflarestorage.com",
            access_key_id     = os.environ.get("R2_ACCESS_KEY_ID", ""),
            secret_access_key = os.environ.get("R2_SECRET_ACCESS_KEY", ""),
            bucket_name       = os.environ.get("R2_BUCKET_NAME", ""),
            public_url        = os.environ.get("R2_PUBLIC_URL", ""),
        )

    if p == "B2":
        endpoint = os.environ.get("B2_ENDPOINT", "")
        if endpoint and not endpoint.startswith("http"):
            endpoint = f"https://{endpoint}"
        return S3Storage(
            endpoint_url      = endpoint,
            access_key_id     = os.environ.get("B2_APPLICATION_KEY_ID", ""),
            secret_access_key = os.environ.get("B2_APPLICATION_KEY", ""),
            bucket_name       = os.environ.get("B2_BUCKET_NAME", ""),
            public_url        = os.environ.get("B2_PUBLIC_URL", ""),  # empty for private
        )

    return LocalStorage(base_path)
