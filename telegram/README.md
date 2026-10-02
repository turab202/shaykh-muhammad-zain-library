# Telegram Importer — Shaykh Muhammad Zain Digital Library

## Architecture

```
Telegram channel
   │
   ▼  [Python/Telethon — this directory]
Raw TelegramMessage record (immutable after insert)
   │
   ▼  [Deterministic parser — parser.py]
SuggestedMetadata (stored as JSONB, separate from raw)
   │
   ▼  [Import Inbox — admin UI]
Administrator review + correction
   │
   ▼  [approveTelegramMessage — server/admin/actions.ts]
Published Lesson + Media record
   │
   ▼  [Public website]
Real audio playback
```

**Key principle:** Raw Telegram data is NEVER overwritten. The
`TelegramMessage.rawJson`, `caption`, `audioFilename`, `telegramFileId`,
`telegramFileUniqueId`, `links` fields are set once at import time and
never modified by any subsequent step (parsing, admin editing, or approval).

Suggested metadata lives in `TelegramMessage.suggestedMetadata` (JSONB)
and is the only thing the administrator edits before approval.

## Prerequisites

```bash
# Python 3.8+
py --version

# Install dependencies
cd telegram
py -m pip install -r requirements.txt
```

## Setup

1. Copy `.env.example` to `.env` (in the telegram/ directory or the project root):
   ```bash
   cp telegram/.env.example telegram/.env
   ```

2. Fill in your values (never commit the filled file):
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5434/zain_library?schema=public
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   TELEGRAM_PHONE=+1234567890
   TELEGRAM_CHANNEL=@ShaykhMuhammadZain_Archive
   ```

3. Make sure the database is running and migrated:
   ```bash
   docker-compose up -d
   npx prisma migrate dev --name init
   ```

## Running the importer

### Offline mode (no Telegram credentials required)
Processes a JSON fixture file. Used for testing and CI.

```bash
# From project root
py -m telegram.importer.importer --offline telegram/fixtures/sample_messages.json

# Dry run (parse only, no DB writes)
py -m telegram.importer.importer --offline telegram/fixtures/sample_messages.json --dry-run
```

### Live mode (requires Telegram credentials)
Connects to the real channel and fetches messages.

```bash
# Fetch the 100 most recent messages
py -m telegram.importer.importer --live --limit 100

# Resume from where you left off (use the highest messageId already imported)
py -m telegram.importer.importer --live --limit 500 --min-id 1800

# Dry run (connect but don't write to DB)
py -m telegram.importer.importer --live --limit 10 --dry-run
```

On first run, Telethon will prompt you to enter the OTP sent to your phone.
A `.session/importer.session` file is created so subsequent runs don't require re-auth.

## Running the tests

```bash
# Parser tests (no DB, no Telegram)
py -m pytest telegram/tests/test_parser.py -v

# Integration tests (requires DATABASE_URL + running DB)
py -m pytest telegram/tests/test_offline_pipeline.py -v

# All tests
py -m pytest telegram/tests/ -v
```

## Resuming imports safely

The importer uses `(chatId, messageId)` as a unique constraint. Running it
again on the same channel is safe — duplicates are automatically skipped.

To import only new messages since last run:
```bash
# Find the highest messageId in the database first:
# SELECT MAX("messageId") FROM telegram_messages;
py -m telegram.importer.importer --live --min-id <max_message_id>
```

## After importing

1. Open the admin interface at `/admin/import`
2. Each imported message appears in the inbox
3. The raw Telegram source is shown (read-only)
4. Suggested metadata is pre-filled by the deterministic parser
5. Correct any metadata as needed
6. Click "Approve & Stage" to create a published Lesson
7. Click "Reject" to dismiss the record

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes (all modes) | PostgreSQL connection string |
| `TELEGRAM_API_ID` | Yes (live mode) | Telegram API app ID from my.telegram.org |
| `TELEGRAM_API_HASH` | Yes (live mode) | Telegram API app hash |
| `TELEGRAM_PHONE` | Yes (live mode) | Phone number for session auth |
| `TELEGRAM_CHANNEL` | Yes (live mode) | Channel @username or numeric ID |
| `STORAGE_PROVIDER` | No | `LOCAL` (default) or `S3` |
| `LOCAL_STORAGE_PATH` | No | Where to save media files (default: `./storage`) |

## Security

- Telegram credentials are used ONLY in this Python process
- They are NEVER passed to Next.js, exposed to the browser, or committed to git
- The `.session/` directory is gitignored
- `telegram/.env` is gitignored
