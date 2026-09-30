-- Muhammad Zain Islamic Digital Library — Initial Migration
-- Apply with: npx prisma migrate deploy
-- Or for development: npx prisma migrate dev --name init

-- Enums
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3');
CREATE TYPE "MediaType" AS ENUM ('AUDIO', 'PDF', 'IMAGE', 'VIDEO', 'DOCUMENT');
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');
CREATE TYPE "ImportSource" AS ENUM ('TELEGRAM');

-- users
CREATE TABLE "users" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "name"         TEXT,
    "passwordHash" TEXT NOT NULL,
    "role"         "UserRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- categories
CREATE TABLE "categories" (
    "id"               TEXT NOT NULL,
    "slug"             TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "translations"     JSONB NOT NULL DEFAULT '{}',
    "description"      TEXT,
    "descTranslations" JSONB NOT NULL DEFAULT '{}',
    "parentId"         TEXT,
    "icon"             TEXT,
    "colorClass"       TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- tags
CREATE TABLE "tags" (
    "id"   TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- imports (defined before telegram_messages because TelegramMessage references it)
CREATE TABLE "imports" (
    "id"          TEXT NOT NULL,
    "source"      "ImportSource" NOT NULL,
    "status"      "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt"   TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "imports" ADD CONSTRAINT "imports_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- telegram_messages
CREATE TABLE "telegram_messages" (
    "id"                   TEXT NOT NULL,
    "messageId"            INTEGER NOT NULL,
    "chatId"               TEXT NOT NULL,
    "caption"              TEXT,
    "text"                 TEXT,
    "date"                 TIMESTAMP(3) NOT NULL,
    "audioFilename"        TEXT,
    "telegramFileId"       TEXT,
    "telegramFileUniqueId" TEXT,
    "links"                JSONB NOT NULL DEFAULT '[]',
    "rawJson"              JSONB NOT NULL,
    "suggestedMetadata"    JSONB NOT NULL DEFAULT '{}',
    "importId"             TEXT,
    "processedAt"          TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "telegram_messages_chatId_messageId_key" ON "telegram_messages"("chatId", "messageId");
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_importId_fkey"
    FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- books (defined before series and lessons because both reference it)
CREATE TABLE "books" (
    "id"                 TEXT NOT NULL,
    "slug"               TEXT NOT NULL,
    "title"              TEXT NOT NULL,
    "translations"       JSONB NOT NULL DEFAULT '{}',
    "author"             TEXT,
    "authorTranslations" JSONB NOT NULL DEFAULT '{}',
    "description"        TEXT,
    "descTranslations"   JSONB NOT NULL DEFAULT '{}',
    "categoryId"         TEXT,
    "coverImageKey"      TEXT,
    "tableOfContents"    JSONB NOT NULL DEFAULT '[]',
    "status"             "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "books_slug_key" ON "books"("slug");
ALTER TABLE "books" ADD CONSTRAINT "books_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- series
CREATE TABLE "series" (
    "id"               TEXT NOT NULL,
    "slug"             TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "translations"     JSONB NOT NULL DEFAULT '{}',
    "description"      TEXT,
    "descTranslations" JSONB NOT NULL DEFAULT '{}',
    "categoryId"       TEXT,
    "bookId"           TEXT,
    "coverImageKey"    TEXT,
    "order"            INTEGER NOT NULL DEFAULT 0,
    "status"           "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");
ALTER TABLE "series" ADD CONSTRAINT "series_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "series" ADD CONSTRAINT "series_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- lessons
CREATE TABLE "lessons" (
    "id"               TEXT NOT NULL,
    "slug"             TEXT NOT NULL,
    "lessonNumber"     INTEGER,
    "title"            TEXT NOT NULL,
    "translations"     JSONB NOT NULL DEFAULT '{}',
    "description"      TEXT,
    "descTranslations" JSONB NOT NULL DEFAULT '{}',
    "categoryId"       TEXT,
    "seriesId"         TEXT,
    "bookId"           TEXT,
    "telegramSourceId" TEXT,
    "status"           "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt"      TIMESTAMP(3),
    "duration"         INTEGER,
    "playCount"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lessons_slug_key" ON "lessons"("slug");
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_seriesId_fkey"
    FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_telegramSourceId_fkey"
    FOREIGN KEY ("telegramSourceId") REFERENCES "telegram_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- lesson_tags
CREATE TABLE "lesson_tags" (
    "lessonId" TEXT NOT NULL,
    "tagId"    TEXT NOT NULL,
    CONSTRAINT "lesson_tags_pkey" PRIMARY KEY ("lessonId", "tagId")
);
ALTER TABLE "lesson_tags" ADD CONSTRAINT "lesson_tags_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_tags" ADD CONSTRAINT "lesson_tags_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- media
CREATE TABLE "media" (
    "id"              TEXT NOT NULL,
    "filename"        TEXT NOT NULL,
    "mimeType"        TEXT NOT NULL,
    "size"            INTEGER NOT NULL,
    "duration"        INTEGER,
    "mediaType"       "MediaType" NOT NULL DEFAULT 'AUDIO',
    "storageKey"      TEXT NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "lessonId"        TEXT,
    "bookId"          TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "media" ADD CONSTRAINT "media_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media" ADD CONSTRAINT "media_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Full-text search indexes (used by Phase F)
CREATE INDEX "lessons_title_fts" ON "lessons" USING GIN (to_tsvector('simple', "title"));
CREATE INDEX "series_title_fts" ON "series" USING GIN (to_tsvector('simple', "title"));
CREATE INDEX "books_title_fts" ON "books" USING GIN (to_tsvector('simple', "title"));
