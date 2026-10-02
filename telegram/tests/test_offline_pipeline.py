"""
Offline end-to-end pipeline test.

Tests the complete pipeline from fixture JSON → database records
without any Telegram connection.

Requires:
  - DATABASE_URL set in .env
  - PostgreSQL running and migrated

Run with: py -m pytest telegram/tests/test_offline_pipeline.py -v
"""

import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Skip all tests in this module if DATABASE_URL is not set
pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set — skipping integration tests",
)


@pytest.fixture(scope="module")
def db():
    from telegram.importer.database import ImportDB
    database_url = os.getenv("DATABASE_URL")
    conn = ImportDB(database_url)
    yield conn
    conn.close()


@pytest.fixture(scope="module")
def storage(tmp_path_factory):
    from telegram.importer.storage import LocalStorage
    base = tmp_path_factory.mktemp("storage")
    return LocalStorage(str(base))


@pytest.fixture(scope="module")
def fixture_messages():
    path = Path(__file__).resolve().parent.parent / "fixtures" / "sample_messages.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


class TestDatabaseInsertion:
    """Verify raw records are inserted correctly and not duplicated."""

    def test_insert_and_exists(self, db):
        from telegram.importer.importer import process_one_message
        from telegram.importer.storage import LocalStorage
        import tempfile

        storage = LocalStorage(tempfile.mkdtemp())
        import_id = db.create_import()

        # Use a unique message_id unlikely to conflict with seed data
        test_msg_id = 99901
        test_chat_id = "test_offline_pipeline"

        # Clean up any previous test run
        with db.conn.cursor() as cur:
            cur.execute(
                'DELETE FROM telegram_messages WHERE "chatId" = %s AND "messageId" = %s',
                (test_chat_id, test_msg_id),
            )
        db.conn.commit()

        result = process_one_message(
            db=db, storage=storage, import_id=import_id,
            chat_id=test_chat_id,
            message_id=test_msg_id,
            caption="شرح رياض الصالحين - الدرس 3",
            date=datetime(2024, 3, 15, 18, 30, tzinfo=timezone.utc),
            audio_filename="riyad_003.mp3",
            telegram_file_id="TEST_FILE_ID",
            telegram_file_unique_id="TEST_UNIQUE_ID",
            raw_json={"test": True, "message_id": test_msg_id},
        )

        assert result["skipped"] is False
        assert result["db_id"] is not None
        assert result["confidence"] >= 0.5

        # Verify it exists in DB
        assert db.message_exists(test_chat_id, test_msg_id)

    def test_duplicate_is_skipped(self, db):
        from telegram.importer.importer import process_one_message
        from telegram.importer.storage import LocalStorage
        import tempfile

        storage = LocalStorage(tempfile.mkdtemp())
        import_id = db.create_import()

        # The same message_id as the previous test — must be skipped
        test_msg_id = 99901
        test_chat_id = "test_offline_pipeline"

        result = process_one_message(
            db=db, storage=storage, import_id=import_id,
            chat_id=test_chat_id,
            message_id=test_msg_id,
            caption="DUPLICATE",
            date=datetime(2024, 3, 15, 18, 30, tzinfo=timezone.utc),
            audio_filename=None,
            telegram_file_id=None,
            telegram_file_unique_id=None,
            raw_json={"test": True},
        )

        assert result["skipped"] is True
        assert result["skip_reason"] == "duplicate"

    def test_raw_fields_preserved(self, db):
        """
        After insertion, the raw caption must be exactly as provided —
        not modified by the parser or any subsequent step.
        """
        with db.conn.cursor() as cur:
            cur.execute(
                'SELECT caption, "suggestedMetadata" FROM telegram_messages '
                'WHERE "chatId" = %s AND "messageId" = %s',
                ("test_offline_pipeline", 99901),
            )
            row = cur.fetchone()
        assert row is not None
        caption, suggested = row
        assert caption == "شرح رياض الصالحين - الدرس 3"
        # suggestedMetadata is separate from caption
        assert isinstance(suggested, dict)
        assert "series_slug" in suggested
        assert suggested["series_slug"] == "riyad-as-salihin"


class TestFullOfflinePipeline:
    """Run the full importer against the fixture file."""

    def test_run_offline_pipeline(self, tmp_path):
        from telegram.importer.importer import run_offline

        fixture_path = str(
            Path(__file__).resolve().parent.parent / "fixtures" / "sample_messages.json"
        )
        database_url = os.getenv("DATABASE_URL")
        storage_base = str(tmp_path / "storage")

        # Clean up any previous test inserts from the fixture
        from telegram.importer.database import ImportDB
        db = ImportDB(database_url)
        with db.conn.cursor() as cur:
            cur.execute(
                'DELETE FROM telegram_messages WHERE "chatId" = %s',
                ("-1001234567890",),
            )
        db.conn.commit()

        results = run_offline(
            fixture_path=fixture_path,
            database_url=database_url,
            storage_base=storage_base,
        )

        db.close()

        assert results is not None
        # 8 messages in fixture, 1 is a duplicate → 7 unique + 1 skip
        inserted = [r for r in results if not r["skipped"]]
        skipped = [r for r in results if r["skipped"]]
        assert len(inserted) == 7, f"Expected 7 insertions, got {len(inserted)}"
        assert len(skipped) == 1, f"Expected 1 skip, got {len(skipped)}"

    def test_high_confidence_messages_detected(self, tmp_path):
        """At least 4 of the 7 non-duplicate messages should have confidence >= 0.7."""
        from telegram.importer.parser import parse_caption
        import json

        fixture_path = Path(__file__).resolve().parent.parent / "fixtures" / "sample_messages.json"
        with open(fixture_path, encoding="utf-8") as f:
            messages = json.load(f)

        # Remove duplicate
        seen = set()
        unique = []
        for m in messages:
            key = (m["chat_id"], m["message_id"])
            if key not in seen:
                seen.add(key)
                unique.append(m)

        high_conf = [
            m for m in unique
            if parse_caption(m.get("caption"), m.get("audio_filename")).confidence >= 0.7
        ]
        assert len(high_conf) >= 4, f"Expected ≥4 high-confidence, got {len(high_conf)}"

    def test_ambiguous_message_low_confidence(self):
        """Case 4 (ambiguous) must have confidence < 0.5 → goes to human review."""
        from telegram.importer.parser import parse_caption
        m = parse_caption("درس مهم في العبادات", "dars_ibadaat.mp3")
        assert m.confidence < 0.5

    def test_import_records_created(self):
        """Each run_offline call creates an Import record."""
        from telegram.importer.database import ImportDB
        database_url = os.getenv("DATABASE_URL")
        db = ImportDB(database_url)
        with db.conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM imports WHERE source = 'TELEGRAM'")
            count = cur.fetchone()[0]
        db.close()
        assert count >= 1

    def test_pending_messages_in_inbox(self):
        """After import, pending (unreviewed) messages should be retrievable."""
        from telegram.importer.database import ImportDB
        database_url = os.getenv("DATABASE_URL")
        db = ImportDB(database_url)
        pending = db.get_pending_messages(limit=50)
        db.close()
        # At least some messages should be in the inbox
        assert len(pending) >= 1
        # Each record must have raw fields intact
        for msg in pending:
            assert msg["chatId"] is not None
            assert msg["messageId"] is not None
            assert msg["rawJson"] is not None
