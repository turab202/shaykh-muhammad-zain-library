"""
Database layer for the Telegram importer.

Uses raw psycopg2 (not Prisma/Node) because this is a standalone Python
process. All SQL matches exactly the schema in prisma/schema.prisma.

Key guarantees:
  - Raw Telegram fields are NEVER overwritten after initial insert.
  - suggestedMetadata is stored separately and may be updated.
  - Duplicate detection uses the (chatId, messageId) unique constraint.
  - A single Import record tracks each run.
"""

import json
import os
import uuid
from datetime import datetime, timezone, date
from typing import Optional

import psycopg2
from psycopg2.extras import RealDictCursor


def _cuid() -> str:
    """Generate a simple unique ID compatible with Prisma cuid() style."""
    import secrets, time
    ts = int(time.time() * 1000)
    rand = secrets.token_urlsafe(16)
    return f"c{ts:x}{rand}"[:25]


class _TelegramJsonEncoder(json.JSONEncoder):
    """
    JSON encoder that handles types returned by Telethon's message.to_dict():
      - datetime  → ISO-8601 string
      - bytes     → hex string (file IDs, access hashes)
      - any other non-serialisable → repr() string
    Raw Telegram data is preserved character-for-character; we only convert
    Python-native types that JSON doesn't support.
    """
    def default(self, obj):  # type: ignore[override]
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, bytes):
            return obj.hex()
        try:
            return super().default(obj)
        except TypeError:
            return repr(obj)


def _dumps_telegram(obj: dict) -> str:
    """Serialize a Telegram message dict to JSON, handling all native types."""
    return json.dumps(obj, cls=_TelegramJsonEncoder, ensure_ascii=False)


class ImportDB:
    def __init__(self, database_url: str):
        # Store original URL for reconnection
        self._db_url = database_url
        # psycopg2 does not understand Prisma's ?schema=public or channel_binding
        # Strip unsupported params, keep sslmode
        if "?" in database_url:
            base = database_url.split("?")[0]
            params = database_url.split("?")[1]
            kept = "&".join(p for p in params.split("&") if p.startswith("sslmode"))
            clean_url = base + ("?" + kept if kept else "")
        else:
            clean_url = database_url
        self._clean_url = clean_url
        self.conn = psycopg2.connect(clean_url)
        self.conn.autocommit = False

    def _reconnect(self):
        """Reconnect to the DB — called when connection drops during long audio downloads."""
        try:
            self.conn.close()
        except Exception:
            pass
        self.conn = psycopg2.connect(self._clean_url)
        self.conn.autocommit = False
        clean_url = base + ("?" + kept if kept else "")
        self.conn = psycopg2.connect(clean_url)
        self.conn.autocommit = False

    def _execute_with_retry(self, fn, max_retries=3):
        """Execute a DB operation, reconnecting on SSL/connection errors."""
        for attempt in range(max_retries):
            try:
                return fn()
            except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                if attempt < max_retries - 1:
                    import logging, time
                    logging.getLogger(__name__).warning(
                        "DB connection error (attempt %d/%d): %s — reconnecting...",
                        attempt + 1, max_retries, e
                    )
                    time.sleep(2 ** attempt)  # exponential backoff
                    self._reconnect()
                else:
                    raise

    def close(self):
        self.conn.close()

    # ── Import job tracking ───────────────────────────────────────────────────

    def create_import(self, created_by_id: Optional[str] = None) -> str:
        """Create an Import record for this run. Returns the import ID."""
        import_id = _cuid()
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO imports (id, source, status, "startedAt", "createdById", "createdAt")
                VALUES (%s, 'TELEGRAM', 'PROCESSING', NOW(), %s, NOW())
                """,
                (import_id, created_by_id),
            )
        self.conn.commit()
        return import_id

    def finish_import(self, import_id: str, status: str = "DONE"):
        with self.conn.cursor() as cur:
            cur.execute(
                """UPDATE imports SET status = %s, "completedAt" = NOW() WHERE id = %s""",
                (status, import_id),
            )
        self.conn.commit()

    def fail_import(self, import_id: str, reason: str = ""):
        with self.conn.cursor() as cur:
            cur.execute(
                """UPDATE imports SET status = 'FAILED', "completedAt" = NOW() WHERE id = %s""",
                (import_id,),
            )
        self.conn.commit()

    # ── TelegramMessage ───────────────────────────────────────────────────────

    def message_exists(self, chat_id: str, message_id: int) -> bool:
        """Returns True if this (chatId, messageId) pair already exists."""
        def _do():
            with self.conn.cursor() as cur:
                cur.execute(
                    'SELECT id FROM telegram_messages WHERE "chatId" = %s AND "messageId" = %s',
                    (chat_id, message_id),
                )
                return cur.fetchone() is not None
        return self._execute_with_retry(_do)

    def insert_raw_message(
        self,
        *,
        chat_id: str,
        message_id: int,
        caption: Optional[str],
        date: datetime,
        audio_filename: Optional[str],
        telegram_file_id: Optional[str],
        telegram_file_unique_id: Optional[str],
        links: list[str],
        raw_json: dict,
        suggested_metadata: dict,
        import_id: Optional[str],
    ) -> str:
        """
        Insert a raw TelegramMessage record.
        Returns the new record's ID.
        NEVER call this twice for the same (chatId, messageId) — check first.

        The raw fields (caption, audioFilename, telegramFileId, etc.) are set
        ONCE here and never updated by subsequent processing.
        """
        record_id = _cuid()
        # Ensure date is timezone-aware UTC
        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)

        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO telegram_messages (
                    id, "messageId", "chatId", caption, text, date,
                    "audioFilename", "telegramFileId", "telegramFileUniqueId",
                    links, "rawJson", "suggestedMetadata", "importId", "createdAt"
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, NOW()
                )
                """,
                (
                    record_id,
                    message_id,
                    chat_id,
                    caption,
                    caption,        # text is an alias for caption
                    date,
                    audio_filename,
                    telegram_file_id,
                    telegram_file_unique_id,
                    json.dumps(links),
                    _dumps_telegram(raw_json),
                    _dumps_telegram(suggested_metadata),
                    import_id,
                ),
            )
        self.conn.commit()
        return record_id

    def update_suggested_metadata(self, record_id: str, suggested_metadata: dict):
        """
        Update ONLY the suggestedMetadata field.
        Raw source fields are untouched.
        """
        with self.conn.cursor() as cur:
            cur.execute(
                'UPDATE telegram_messages SET "suggestedMetadata" = %s WHERE id = %s',
                (_dumps_telegram(suggested_metadata), record_id),
            )
        self.conn.commit()

    def get_pending_messages(self, limit: int = 100) -> list[dict]:
        """Return unprocessed TelegramMessage records (processedAt IS NULL)."""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM telegram_messages
                WHERE "processedAt" IS NULL
                ORDER BY date ASC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]

    # ── Media ─────────────────────────────────────────────────────────────────

    def insert_media(
        self,
        *,
        filename: str,
        mime_type: str,
        size: int,
        duration_seconds: Optional[int],
        media_type: str,        # 'AUDIO' | 'PDF' | 'IMAGE' | 'DOCUMENT'
        storage_key: str,
        storage_provider: str = "LOCAL",
        lesson_id: Optional[str] = None,
        book_id: Optional[str] = None,
    ) -> str:
        media_id = _cuid()
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO media (
                    id, filename, "mimeType", size, duration,
                    "mediaType", "storageKey", "storageProvider",
                    "lessonId", "bookId", "createdAt"
                ) VALUES (%s, %s, %s, %s, %s, %s::\"MediaType\", %s, %s::\"StorageProvider\", %s, %s, NOW())
                """,
                (
                    media_id, filename, mime_type, size, duration_seconds,
                    media_type, storage_key, storage_provider,
                    lesson_id, book_id,
                ),
            )
        self.conn.commit()
        return media_id

    # ── Lookup helpers ────────────────────────────────────────────────────────

    def find_series_id_by_slug(self, slug: str) -> Optional[str]:
        with self.conn.cursor() as cur:
            cur.execute('SELECT id FROM series WHERE slug = %s', (slug,))
            row = cur.fetchone()
            return row[0] if row else None

    def find_category_id_by_slug(self, slug: str) -> Optional[str]:
        with self.conn.cursor() as cur:
            cur.execute('SELECT id FROM categories WHERE slug = %s', (slug,))
            row = cur.fetchone()
            return row[0] if row else None

    def find_book_id_by_slug(self, slug: str) -> Optional[str]:
        with self.conn.cursor() as cur:
            cur.execute('SELECT id FROM books WHERE slug = %s', (slug,))
            row = cur.fetchone()
            return row[0] if row else None

    def lesson_slug_exists(self, slug: str) -> bool:
        with self.conn.cursor() as cur:
            cur.execute('SELECT 1 FROM lessons WHERE slug = %s', (slug,))
            return cur.fetchone() is not None

    def get_lesson_count_in_series(self, series_id: str) -> int:
        with self.conn.cursor() as cur:
            cur.execute(
                'SELECT COUNT(*) FROM lessons WHERE "seriesId" = %s',
                (series_id,),
            )
            row = cur.fetchone()
            return row[0] if row else 0
