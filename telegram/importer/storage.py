"""
Storage abstraction for downloaded Telegram media.

Supports:
  - LOCAL: saves files under LOCAL_STORAGE_PATH (default: ./storage/)
  - S3: (future) upload to S3-compatible bucket

The storage key (relative path) is what gets saved in the Media.storageKey
database column. The actual file lives outside PostgreSQL.

Format: audio/{year}/{safe_filename}
        pdf/{year}/{safe_filename}
"""

import os
import re
import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional


def _safe_filename(name: str) -> str:
    """Normalise a filename: keep alphanumeric, dots, dashes, underscores."""
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
    """Saves files to LOCAL_STORAGE_PATH directory tree."""

    def __init__(self, base_path: str):
        self.base = Path(base_path)
        self.base.mkdir(parents=True, exist_ok=True)

    def save(
        self,
        source_path: str,
        original_filename: str,
        mime_type: str,
        message_date: Optional[datetime] = None,
    ) -> str:
        """
        Move/copy a downloaded file into structured storage.
        Returns the storage key (relative path from base).
        """
        year = (message_date or datetime.utcnow()).year
        subdir = _media_subdir(mime_type)
        safe_name = _safe_filename(original_filename)

        # Avoid collision: append short hash of original path
        file_hash = hashlib.md5(original_filename.encode()).hexdigest()[:8]
        stem, ext = os.path.splitext(safe_name)
        unique_name = f"{stem}_{file_hash}{ext}"

        dest_dir = self.base / subdir / str(year)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / unique_name

        shutil.move(source_path, dest_path)

        # Return relative key (used as Media.storageKey)
        storage_key = f"{subdir}/{year}/{unique_name}"
        return storage_key

    def url_for(self, storage_key: str) -> str:
        """Resolve a storage key to an absolute file path (for local dev)."""
        return str(self.base / storage_key)

    def exists(self, storage_key: str) -> bool:
        return (self.base / storage_key).exists()


def get_storage(provider: str = "LOCAL", base_path: str = "./storage") -> LocalStorage:
    """
    Factory — returns the appropriate storage backend.
    Only LOCAL is implemented; S3 support is a future addition.
    """
    if provider.upper() == "LOCAL":
        return LocalStorage(base_path)
    raise NotImplementedError(f"Storage provider {provider!r} not yet implemented. Use LOCAL for now.")
