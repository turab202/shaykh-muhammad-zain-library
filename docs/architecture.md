# Architecture — Muhammad Zain Islamic Digital Library

## Overview

A single Next.js 16 application serving the public website, admin dashboard, API, and all server-side logic. No separate backend, no microservices.

```
Browser
  └── Next.js (App Router)
        ├── Public pages        src/app/[locale]/(public)/
        ├── Admin pages         src/app/[locale]/admin/
        ├── Auth pages          src/app/(auth)/
        ├── API routes          src/app/api/
        ├── Server actions      src/server/
        └── Prisma → PostgreSQL
```

---

## Technology Decisions

### Framework: Next.js 16 (App Router)

- All routing, rendering, and API endpoints live here.
- React Server Components are used for database queries by default.
- Client Components (`"use client"`) are used only where interactivity is required.
- **Breaking change from earlier versions:** `middleware.ts` is replaced by `proxy.ts`, export renamed from `middleware` to `proxy`.

### Database: PostgreSQL + Prisma

- PostgreSQL is the single source of truth for all application data.
- Prisma ORM handles schema, migrations, and type-safe queries.
- Local development uses Docker (`docker-compose.yml`) on port 5432.
- The Prisma client singleton is in `src/lib/db.ts`.

### Authentication: Custom session (jose + bcryptjs)

- Admin-only in Phase 1. Public registration is deferred.
- Sessions are stateless JWT tokens stored in `httpOnly` cookies.
- `jose` handles JWT signing/verification (HS256, 7-day expiry).
- `bcryptjs` hashes passwords (12 rounds).
- Session logic: `src/lib/auth/session.ts`
- Password helpers: `src/lib/auth/password.ts`
- Login/logout server actions: `src/server/auth/actions.ts`
- Auth guard in proxy: `src/proxy.ts` (intercepts `/admin` routes)

**Why not NextAuth?** NextAuth v5 compatibility with Next.js 16's `proxy.ts` file convention (replacing `middleware.ts`) was not confirmed at project start. The Next.js 16 documentation demonstrates this first-party session pattern directly. NextAuth can be added later if needed.

### Internationalisation: next-intl v4

- Supported locales: `en` (English, LTR), `ar` (Arabic, RTL), `am` (Amharic, LTR).
- Route structure: `src/app/[locale]/` — locale is always present in the URL.
- RTL is applied by setting `dir="rtl"` on the `<html>` element when locale is `ar`.
- Translation messages live in `src/i18n/messages/{locale}.json`.
- Routing config: `src/i18n/routing.ts`
- Request config (server): `src/i18n/request.ts`
- Navigation helpers: `src/i18n/navigation.ts`
- Locale detection and redirect handled by next-intl middleware inside `proxy.ts`.

**Translation policy:** UI strings in `ar.json` and `am.json` are human-written. Religious or content translations are never fabricated by AI. Missing translations fall back to English.

### Styling: Tailwind CSS v4

- Uses the new `@import "tailwindcss"` syntax (v4, not v3).
- RTL-compatible Tailwind logical property utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`) are preferred over physical (`ml-*`, `mr-*`, etc.) in shared components.
- Global styles: `src/app/globals.css`.

### Media Storage

- PostgreSQL stores only metadata (filename, MIME type, size, duration, storage key).
- Actual files are stored outside PostgreSQL.
- `storageProvider` field supports `LOCAL` (dev) and `S3` (future).
- No S3 SDK is installed in Phase 1.
- Storage key format: `<type>/<year>/<filename>` (e.g. `audio/2025/lesson-001.mp3`).

### Search

- PostgreSQL full-text search (`tsvector`/`tsquery`) for Phase 1.
- No external search engine (Elasticsearch, Meilisearch, etc.) until PostgreSQL proves insufficient.

### AI

- AI is optional and not a runtime dependency.
- No AI SDK installed in Phase 1.
- The application must function fully without any AI service.

---

## Directory Structure

```
src/
├── app/
│   ├── [locale]/          ← All localized public + admin pages
│   │   ├── (public)/      ← Public-facing pages (no auth required)
│   │   └── admin/         ← Admin pages (session required)
│   ├── (auth)/            ← Auth pages (login) — outside locale routing
│   ├── api/               ← Route Handlers (future)
│   ├── layout.tsx         ← Root shell (thin wrapper)
│   └── globals.css
│
├── components/
│   └── ui/                ← shadcn/ui components (added per-component)
│
├── i18n/
│   ├── messages/          ← en.json, ar.json, am.json
│   ├── routing.ts         ← Locale config
│   ├── request.ts         ← next-intl server config
│   └── navigation.ts      ← Typed Link, useRouter, etc.
│
├── lib/
│   ├── db.ts              ← Prisma client singleton
│   └── auth/
│       ├── session.ts     ← JWT session management
│       └── password.ts    ← bcrypt helpers
│
├── server/                ← Server-only domain logic (no browser imports)
│   └── auth/
│       └── actions.ts     ← login / logout server actions
│
└── types/
    └── i18n.ts            ← LocalizedText, Locale, helpers

prisma/
├── schema.prisma
└── seed.ts                ← (to be created in Phase 2)

docs/
└── architecture.md        ← this file
```

---

## Database Schema (Phase 1)

### Key design decisions

1. **Translations as JSONB** — `{ en?, ar?, am? }` stored in `translations`/`descTranslations` columns. Typed as `LocalizedText` in TypeScript (`src/types/i18n.ts`). No separate translation table needed at this scale.

2. **Lesson relationships** — A lesson may belong to a Series, a Book, both, or neither. `seriesId` and `bookId` are both nullable independently (not XOR).

3. **Media metadata only** — The `Media` table stores file metadata and a `storageKey`. Actual files never enter PostgreSQL.

4. **TelegramMessage is an inbox** — Raw Telegram data sits in review until a human admin approves it. Nothing is auto-published from an import.

5. **Public users deferred** — `User` is admin-only in Phase 1. Bookmark and UserProgress tables are not created yet.

### Entity summary

| Model            | Purpose                                      |
|------------------|----------------------------------------------|
| `User`           | Admin/editor accounts                        |
| `Category`       | Hierarchical content categories              |
| `Tag`            | Flat tags for lessons                        |
| `Series`         | Named lesson collections                     |
| `Book`           | Texts lessons may be tied to                 |
| `Lesson`         | Core content unit                            |
| `LessonTag`      | Many-to-many join: Lesson ↔ Tag              |
| `Media`          | File metadata (audio, PDF, etc.)             |
| `Import`         | Batch import job tracker                     |
| `TelegramMessage`| Raw Telegram messages awaiting review        |

---

## Running the project

```bash
# 1. Copy and fill in environment variables
cp .env.example .env.local

# 2. Start PostgreSQL
docker-compose up -d

# 3. Install dependencies
npm install

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Start the development server
npm run dev
```

---

## Telegram Archive — Principles and Future Import Pipeline

> **Status: not yet implemented.** No importer code, folders, Telethon dependencies,
> worker processes, or additional database tables have been created. This section
> records the architectural principles that must govern any future implementation.

### Telegram is a source, not the database

Telegram channels and groups are the original archive of Shaykh Muhammad Zain's
content. They are the raw source. They are **not** the permanent published database.
Content is only considered published once it has been reviewed by a human administrator
and explicitly promoted into the library's domain records (Category, Series, Book,
Lesson, Media).

The public website never reads directly from Telegram data. Telegram data is always
an upstream input to a human-mediated pipeline, never a direct data source for
the published library.

### Raw archive records must be preserved separately

Raw Telegram source data must be stored separately from any interpreted or
suggested metadata derived from it. The original Telegram record is immutable
evidence of what was actually published in the channel. Parsed metadata is a
derivative that may be corrected, rejected, or replaced without affecting the
original archive record.

A raw Telegram archive record must preserve, where available:

| Field | Description |
|---|---|
| `chatId` | Telegram channel or group ID |
| `messageId` | Telegram message ID (unique within the chat) |
| `date` | Original message date from Telegram |
| `caption` | Original message caption text, verbatim |
| `audioFilename` | Original audio filename as reported by Telegram |
| `telegramFileId` | Telegram media/file identifier |
| `telegramFileUniqueId` | Telegram permanent unique file identifier |
| `links` | Any URLs present in the message or caption |
| `rawJson` | Complete raw message payload from the Telegram API |

The `TelegramMessage` model in the current schema captures `messageId`, `chatId`,
`date`, `text`, `rawJson`, and `importId`. Additional fields for audio metadata
(`audioFilename`, `telegramFileId`, `telegramFileUniqueId`, `links`) will be added
to this model or a related table when the importer is implemented.

### The import pipeline

The future import flow is:

```
Telegram (original source/archive)
  │
  ▼
Raw Archive Record          ← verbatim preservation of Telegram data
  │
  ▼
Metadata Extraction         ← deterministic rules first (see below)
  │
  ▼
Import Inbox                ← pending records awaiting administrator action
  │
  ▼
Administrator Review        ← human corrects, confirms, or rejects each record
  │
  ▼
Published Library           ← Category / Series / Book / Lesson / Media
```

No step in this pipeline is automatic end-to-end. Human review is mandatory
before anything is published.

### Metadata extraction — deterministic rules first

When extracting structured metadata from a raw Telegram message, deterministic
pattern-matching must be attempted before any AI is involved. Examples of
deterministic extraction:

- Known book or kitāb title patterns in the caption
- Lesson number patterns (e.g. `درس ٣`, `Lesson 3`, `#003`)
- Known caption field structures used in the channel
- Dates extracted from the message timestamp or caption text
- URLs and links parsed from the caption
- Known Telegram forwarded-message structures
- Audio duration and filename from the Telegram media object

Deterministic rules produce a `SuggestedMetadata` record alongside the
`TelegramMessage`. This suggestion is what the administrator reviews — it
is never automatically applied.

### AI assistance — optional and bounded

AI may later assist a human administrator in cases where deterministic rules
produce low-confidence results or no result at all. Examples of acceptable
AI assistance:

- Suggesting a series or category when the caption is ambiguous
- Suggesting a title when no structured title pattern was found
- Flagging a message as likely a duplicate

AI assistance is subject to these hard constraints:

1. **AI is never required.** The import pipeline must function completely
   without any AI service. If AI is unavailable, the administrator can
   still review and publish content using only the raw archive record
   and any deterministic suggestions.

2. **AI never publishes.** Every AI suggestion must be visible to and
   explicitly confirmed by a human administrator before it affects any
   published record.

3. **AI never modifies the raw archive record.** AI operates only on
   the `SuggestedMetadata` layer, never on the `TelegramMessage` raw record.

4. **The public website has no dependency on AI.** No public page, search
   result, or media record requires AI to render or function.

5. **Religious metadata requires special care.** AI-suggested titles,
   series names, or categories for Islamic content must be reviewed with
   particular care. Fabricated or incorrect religious metadata must never
   reach the published library.

---

## Phase 2 — planned (not yet built)

- Public lessons, series, and books pages
- Admin CRUD for lessons, series, books, categories, tags
- Media upload and management
- Full-text search
- Seed script
- shadcn/ui component library setup
