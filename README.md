# Shaykh Muhammad Zain Library

A modern multilingual Islamic digital library and admin platform built with Next.js, Prisma, and PostgreSQL. The project is designed to catalogue and present Islamic content such as books, lessons, series, categories, and media while preserving a clean editorial workflow for administrators and future Telegram-based imports.

## Overview

This repository contains a full-stack web application for publishing and managing a digital library around the teachings and lectures of Shaykh Muhammad Zain. It includes:

- A public-facing multilingual library UI
- Admin-only management screens for books, categories, series, lessons, and media
- Authenticated admin access with secure session cookies
- PostgreSQL-backed persistent storage using Prisma
- Local audio/media handling and future-ready storage abstraction
- An import pipeline for raw Telegram content reviewed by a human before publication

The application is intentionally built in one cohesive codebase rather than as a microservice architecture, keeping content, administration, and presentation closely tied together.

## Core Features

### Public library experience

- Browse content by category, book, series, and lesson
- Multilingual interface with English, Arabic, and Amharic support
- Search and navigation across the library catalog
- Audio playback for lessons and media content
- RTL-aware UI behavior for Arabic content

### Admin workflow

- Secure administrative login
- Review and publish imported content
- Manage categories, books, series, lessons, and media metadata
- Enforce a human review step before content becomes public

### Content ingestion and archival flow

- Import Telegram messages as raw archive records
- Store source messages separately from suggested metadata
- Allow admin review and approval before publishing
- Preserve source fidelity while building a managed content library

## Tech Stack

- Next.js 16 with App Router
- React 19 and TypeScript
- Tailwind CSS v4
- PostgreSQL with Prisma ORM
- Docker Compose for local database setup
- next-intl for localization
- Custom JWT-based session management with `jose` and `bcryptjs`
- Python Telegram import tooling under `telegram/`

## Project Structure

```text
.
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── [locale]/
│   │   ├── api/
│   │   └── globals.css
│   ├── components/
│   ├── i18n/
│   ├── lib/
│   ├── server/
│   └── types/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── telegram/
│   ├── importer/
│   ├── tests/
│   └── fixtures/
├── storage/
├── public/
├── docs/
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.ts
├── README.md
└── vercel.json
```

## Architecture

The repository follows a single-application architecture:

```text
Browser
  └── Next.js App Router
        ├── Public pages
        ├── Admin pages
        ├── API routes
        ├── Server actions
        └── Prisma -> PostgreSQL
```

This keeps the project easier to reason about, especially for a content-heavy library that needs editorial oversight. The public site, admin interface, and database logic live in the same application rather than being split into separate services.

## Local Development Setup

### Prerequisites

- Node.js 20+
- npm
- Docker Desktop or Docker Engine
- Optional: Python 3.10+ for Telegram importer tooling

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Copy the example environment file and update the values for your local setup:

```bash
cp .env.example .env.local
```

A typical local setup looks like this:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/zain_library?schema=public"
SESSION_SECRET="replace-with-a-32-char-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
STORAGE_PROVIDER="local"
LOCAL_STORAGE_PATH="./storage"
SEED_ADMIN_EMAIL="admin@library.local"
SEED_ADMIN_PASSWORD="change-me-immediately"
```

> The database is exposed on port `5434` in local Docker setup, even though PostgreSQL itself listens on port `5432` inside the container.

### 3) Start PostgreSQL

```bash
docker compose up -d
```

### 4) Run database migrations

```bash
npx prisma migrate dev --name init
```

### 5) Seed the database

```bash
npm run db:seed
```

This creates the initial admin user and a starter dataset for categories, books, series, and lessons.

### 6) Start the application

```bash
npm run dev
```

Open http://localhost:3000 to view the app.

## Database and Prisma

The project uses PostgreSQL as the primary source of truth and Prisma as the ORM layer for schema management and type-safe queries.

Key commands:

```bash
npm run db:migrate
npm run db:generate
npm run db:studio
```

The schema is defined in `prisma/schema.prisma` and includes the core domain models for:

- `User`
- `Category`
- `Tag`
- `Book`
- `Series`
- `Lesson`
- `Media`
- `Import`
- `TelegramMessage`

## Admin Access

After seeding, sign in using the configured admin credentials. The default admin route is protected and available under the locale-aware admin area, for example:

```text
/admin
```

The admin portal is designed for content curation and operational oversight, including import review.

## Telegram Import Pipeline

This repository includes a Python-based importer under `telegram/` for working with raw Telegram message archives.

The workflow follows a human-reviewed editorial model:

```text
Telegram source
  ↓
Raw message archive
  ↓
Deterministic parsing
  ↓
Import inbox
  ↓
Admin review / correction
  ↓
Published lesson / media
```

Important design principle:

- raw Telegram data is retained as source evidence
- suggested metadata is separate from the original record
- nothing is auto-published without human approval

For details, see the importer documentation in `telegram/README.md`.

## Content Model Notes

The application is structured around Islamic educational content rather than generic blog posts. The library supports the following patterns:

- categories such as hadith, tafsir, aqidah, fiqh, and Arabic language
- books and lecture series as organizing containers
- lessons as primary content units
- media files such as audio and PDF assets
- optional richer metadata including translations and localized content fields

## Storage Strategy

The application supports multiple storage providers, with local development using the filesystem:

- `STORAGE_PROVIDER=local` stores media under the `storage/` directory
- the system uses a storage key convention like `audio/2026/file-name.mp3`
- this is designed to support future S3-compatible object storage without rewriting the domain model

## Security and Operational Notes

- `SESSION_SECRET` should be a strong random value in production
- `.env.local` and other secret files should never be committed
- session handling is implemented with secure cookies and JWT signing
- admin-only access is enforced for privileged pages
- Telegram credentials should remain isolated to the importer process and not be exposed to the browser

## Production Considerations

This project is designed for a real deployment environment, but a few production decisions should still be made explicitly before launch:

- set a secure `SESSION_SECRET`
- use a production-grade PostgreSQL instance
- configure proper CORS and host settings as needed
- define a real storage backend if you plan to serve media publicly
- review and adjust admin credentials before exposing the app online

## Useful Commands

```bash
npm run dev         # start local development
npm run build       # build production bundle
npm run start       # run production build
npm run lint        # lint the codebase
npx prisma studio   # view database in Prisma Studio
npx prisma migrate dev --name <name>
```

## Contributing

Contributions are welcome if they improve the library experience, strengthen the admin workflow, or increase reliability of the content import system. Before making changes, it is recommended to:

1. run the project locally
2. update the relevant schema or migration when changing data models
3. verify behavior with the existing Prisma and importer tooling
4. keep religious content handling careful, accurate, and respectful

## License

This project is intended for educational and community use. Please review repository ownership and licensing requirements before publishing or redistributing content beyond the local project context.
