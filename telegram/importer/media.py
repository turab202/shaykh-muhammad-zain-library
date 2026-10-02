"""
Media download and inspection utilities.

Downloads audio/PDF files from Telegram and extracts technical metadata
(duration, size, MIME type) before handing off to storage.
"""

import os
import mimetypes
import tempfile
from typing import Optional
from pathlib import Path

# mutagen is used for audio duration extraction — graceful fallback if missing
try:
    from mutagen import File as MutagenFile
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False


AUDIO_EXTENSIONS = {".mp3", ".m4a", ".ogg", ".opus", ".wav", ".aac", ".flac"}
PDF_EXTENSIONS = {".pdf"}


def get_mime_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in AUDIO_EXTENSIONS:
        return {
            ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4",
            ".ogg": "audio/ogg",
            ".opus": "audio/ogg",
            ".wav": "audio/wav",
            ".aac": "audio/aac",
            ".flac": "audio/flac",
        }.get(ext, "audio/mpeg")
    if ext == ".pdf":
        return "application/pdf"
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def get_media_type_enum(mime_type: str) -> str:
    """Returns the MediaType enum value for the database."""
    if mime_type.startswith("audio/"):
        return "AUDIO"
    if mime_type == "application/pdf":
        return "PDF"
    if mime_type.startswith("image/"):
        return "IMAGE"
    if mime_type.startswith("video/"):
        return "VIDEO"
    return "DOCUMENT"


def get_audio_duration_seconds(filepath: str) -> Optional[int]:
    """
    Extract audio duration in seconds using mutagen.
    Returns None if mutagen is not installed or duration cannot be read.
    """
    if not MUTAGEN_AVAILABLE:
        return None
    try:
        audio = MutagenFile(filepath)
        if audio is not None and hasattr(audio, "info") and hasattr(audio.info, "length"):
            return int(audio.info.length)
    except Exception:
        pass
    return None


def get_file_size(filepath: str) -> int:
    return os.path.getsize(filepath)


class TelegramMediaDownloader:
    """
    Wraps Telethon media download for audio and PDF files.
    Only instantiated when running in live mode (not offline tests).
    """

    def __init__(self, client, temp_dir: Optional[str] = None):
        self._client = client
        self._temp_dir = temp_dir or tempfile.gettempdir()

    async def download(self, message, suggested_filename: Optional[str] = None) -> Optional[str]:
        """
        Download the media attached to a Telethon message.
        Returns the local file path, or None if no downloadable media.
        """
        if message.media is None:
            return None

        dest = os.path.join(self._temp_dir, suggested_filename or "download")
        downloaded = await self._client.download_media(message, file=dest)
        return downloaded if downloaded and os.path.exists(downloaded) else None
