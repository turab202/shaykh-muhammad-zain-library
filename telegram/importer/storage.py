"""
Storage abstraction for downloaded Telegram media.

Supports:
  - LOCAL:  saves files under LOCAL_STORAGE_PATH (default: ./storage/)
  - R2:     uploads to Cloudflare R2 (S3-compatible)

The storage key is saved in Media.storageKey.
For LOCAL: relative path  → served via /api/media/{key}
For R2:    full HTTPS URL → served directly from CDN
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


class LocalStorage:
    def __init__(self, base_path: str):
        self.base = Path(base_path)
        self.base.mkdir(parents=True, exist_ok=True)

    def save(self, source_path: str, original_filename: str, mime_type: str,
             message_date: Optional[datetime] = None) -> str:
        year = (message_date or datetime.utcnow()).year
        subdir = _media_subdir(mime_type)
        safe_name = _safe_filename(original_filename)
        file_hash = hashlib.md5(original_filename.encode()).hexdigest()[:8]
        stem, ext = os.path.splitext(safe_name)
        unique_name = f"{stem}_{file_hash}{ext}"
        dest_dir = self.base / subdir / str(year)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / unique_name
        shutil.move(source_path, dest_path)
        return f"{subdir}/{year}/{unique_name}"

    def url_for(self, storage_key: str) -> str:
        return str(self.base / storage_key)

    def exists(self, storage_key: str) -> bool:
        return (self.base / storage_key).exists()


class R2Storage:
    """
    Cloudflare R2 storage (S3-compatible).
    Files are uploaded to R2 and the public CDN URL is returned as the storage key.
    """

    def __init__(
        self,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str,
        public_url: str,  # e.g. https://pub-xxxx.r2.dev  OR custom domain
    ):
        self.bucket = bucket_name
        self.public_url = public_url.rstrip("/")
        self._account_id = account_id
        self._endpoint = f"https://{account_id}.r2.cloudflarestorage.com"

        try:
            import boto3
            self._s3 = boto3.client(
                "s3",
                endpoint_url=self._endpoint,
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                region_name="auto",
            )
        except ImportError:
            raise ImportError(
                "boto3 is required for R2 storage. Install it with:\n"
                "  pip install boto3"
            )

    def _object_key(self, original_filename: str, mime_type: str,
                    message_date: Optional[datetime] = None) -> str:
        year = (message_date or datetime.utcnow()).year
        subdir = _media_subdir(mime_type)
        safe = _safe_filename(original_filename)
        h = hashlib.md5(original_filename.encode()).hexdigest()[:8]
        stem, ext = os.path.splitext(safe)
        return f"{subdir}/{year}/{stem}_{h}{ext}"

    def save(self, source_path: str, original_filename: str, mime_type: str,
             message_date: Optional[datetime] = None) -> str:
        key = self._object_key(original_filename, mime_type, message_date)
        with open(source_path, "rb") as f:
            self._s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=f,
                ContentType=mime_type,
                CacheControl="public, max-age=31536000",  # 1 year
            )
        # Return the public CDN URL — this is what goes in Media.storageKey
        public_cdn_url = f"{self.public_url}/{key}"
        return public_cdn_url

    def url_for(self, storage_key: str) -> str:
        # storage_key IS already the full URL for R2
        return storage_key

    def exists(self, storage_key: str) -> bool:
        # Extract object key from full URL
        key = storage_key.replace(f"{self.public_url}/", "")
        try:
            self._s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False


def get_storage(provider: str = "LOCAL", base_path: str = "./storage"):
    """Factory — returns the appropriate storage backend from env vars."""
    provider = provider.upper()

    if provider == "R2":
        account_id        = os.environ.get("R2_ACCOUNT_ID", "")
        access_key_id     = os.environ.get("R2_ACCESS_KEY_ID", "")
        secret_access_key = os.environ.get("R2_SECRET_ACCESS_KEY", "")
        bucket_name       = os.environ.get("R2_BUCKET_NAME", "")
        public_url        = os.environ.get("R2_PUBLIC_URL", "")

        missing = [k for k, v in {
            "R2_ACCOUNT_ID": account_id,
            "R2_ACCESS_KEY_ID": access_key_id,
            "R2_SECRET_ACCESS_KEY": secret_access_key,
            "R2_BUCKET_NAME": bucket_name,
            "R2_PUBLIC_URL": public_url,
        }.items() if not v]

        if missing:
            raise ValueError(
                f"Missing R2 environment variables: {', '.join(missing)}\n"
                "Add them to your .env file."
            )

        return R2Storage(account_id, access_key_id, secret_access_key, bucket_name, public_url)

    # Default: LOCAL
    return LocalStorage(base_path)
