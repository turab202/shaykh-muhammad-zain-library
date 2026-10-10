import "server-only";
import { prisma } from "@/lib/db";
import type { Locale } from "@/types/i18n";
import type { PublicLesson, LessonFilters } from "@/types/library";

function resolveJson(json: unknown, locale: Locale): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const t = json as Record<string, string>;
  return t[locale] ?? t.en ?? undefined;
}

/** Convert a storageKey to a playable URL.
 * - Absolute URLs (http/https) → returned as-is
 * - s3://bucket/key → /api/media/presign?key=... (client fetches pre-signed URL, sets on audio.src)
 * - Relative keys → /api/media/key (local file)
 */
function storageKeyToUrl(key: string | undefined | null): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  if (key.startsWith("s3://")) {
    const objectKey = key.split("/").slice(3).join("/"); // strip s3://bucket/
    return `/api/media/presign?key=${encodeURIComponent(objectKey)}`;
  }
  return `/api/media/${key}`;
}

/**
 * Resolve the audio URL for a lesson.
 * Priority:
 *  1. Media record storageKey (local file or external URL)
 *  2. Telegram message proxy URL (stream from Telegram CDN via bot)
 *  3. Empty string (no audio available)
 */
function resolveAudioUrl(
  storageKey: string | null | undefined,
  telegramSourceId: string | null | undefined,
  telegramMessageId: number | null | undefined
): string {
  if (storageKey) return storageKeyToUrl(storageKey);
  // No local file — proxy from Telegram if we have the message ID
  if (telegramMessageId) return `/api/audio/${telegramMessageId}`;
  return "";
}

type LessonRow = Awaited<ReturnType<typeof prisma.lesson.findMany>>[0] & {
  category?: { name: string; slug: string; translations: unknown } | null;
  series?: { title: string; slug: string; translations: unknown } | null;
  book?: { title: string; slug: string; translations: unknown } | null;
  media?: { storageKey: string; mediaType: string }[];
  tags?: { tag: { slug: string } }[];
  telegramSource?: { messageId: number } | null;
};

function toPublicLesson(row: LessonRow, locale: Locale): PublicLesson {
  const audioMedia = row.media?.find((m) => m.mediaType === "AUDIO");
  const pdfMedia = row.media?.find((m) => m.mediaType === "PDF");
  const title = resolveJson(row.translations, locale) ?? row.title;
  const description = resolveJson(row.descTranslations ?? {}, locale) ?? row.description ?? undefined;
  // If the lesson has a description (surah/ayah info), use it as the display title
  // so users see "سورة إبراهيم — الآية 24–34" instead of "Tafsīr as-Saʿdī — Lesson 230"
  const displayTitle = description ?? title;
  return {
    id: row.id,
    slug: row.slug,
    lessonNumber: row.lessonNumber ?? undefined,
    title,
    displayTitle,
    description,
    audioUrl: resolveAudioUrl(
      audioMedia?.storageKey,
      row.telegramSourceId,
      row.telegramSource?.messageId
    ),
    pdfUrl: pdfMedia?.storageKey ?? undefined,
    duration: row.duration ?? 0,
    publishedAt: row.publishedAt?.toISOString().split("T")[0],
    categoryId: row.categoryId ?? undefined,
    categoryName: row.category ? (resolveJson(row.category.translations, locale) ?? row.category.name) : undefined,
    seriesId: row.seriesId ?? undefined,
    seriesTitle: row.series ? (resolveJson(row.series.translations, locale) ?? row.series.title) : undefined,
    seriesSlug: row.series?.slug,
    bookId: row.bookId ?? undefined,
    bookTitle: row.book ? (resolveJson(row.book.translations, locale) ?? row.book.title) : undefined,
    bookSlug: row.book?.slug,
    tags: row.tags?.map((t) => t.tag.slug),
    playCount: row.playCount,
  };
}

const INCLUDE = {
  category: { select: { name: true, slug: true, translations: true } },
  series: { select: { title: true, slug: true, translations: true } },
  book: { select: { title: true, slug: true, translations: true } },
  media: { select: { storageKey: true, mediaType: true } },
  tags: { include: { tag: { select: { slug: true } } } },
  telegramSource: { select: { messageId: true } },
} as const;

export async function getPublishedLessons(locale: Locale, filters?: LessonFilters): Promise<PublicLesson[]> {
  const where: Record<string, unknown> = { status: "PUBLISHED" };
  if (filters?.categoryId && filters.categoryId !== "all") where.categoryId = filters.categoryId;
  if (filters?.seriesId && filters.seriesId !== "all") where.seriesId = filters.seriesId;
  if (filters?.bookId && filters.bookId !== "all") where.bookId = filters.bookId;

  let orderBy: Record<string, string> | Record<string, string>[] = { publishedAt: "desc" };
  if (filters?.sortBy === "lesson_number") orderBy = [{ seriesId: "asc" }, { lessonNumber: "asc" }];
  if (filters?.sortBy === "oldest") orderBy = { publishedAt: "asc" };
  if (filters?.sortBy === "title") orderBy = { title: "asc" };

  const rows = await prisma.lesson.findMany({ where, orderBy, include: INCLUDE });
  return rows.map((r) => toPublicLesson(r as LessonRow, locale));
}

export async function getLessonBySlug(slug: string, locale: Locale): Promise<PublicLesson | null> {
  const row = await prisma.lesson.findUnique({ where: { slug }, include: INCLUDE });
  if (!row) return null;
  return toPublicLesson(row as LessonRow, locale);
}

export async function getLessonsBySeries(seriesId: string, locale: Locale): Promise<PublicLesson[]> {
  const rows = await prisma.lesson.findMany({
    where: { seriesId, status: "PUBLISHED" },
    orderBy: [{ publishedAt: "asc" }, { lessonNumber: "asc" }],
    include: INCLUDE,
  });
  return rows.map((r) => toPublicLesson(r as LessonRow, locale));
}

export async function getLessonsByBook(bookId: string, locale: Locale): Promise<PublicLesson[]> {
  const rows = await prisma.lesson.findMany({
    where: { bookId, status: "PUBLISHED" },
    orderBy: { lessonNumber: "asc" },
    include: INCLUDE,
  });
  return rows.map((r) => toPublicLesson(r as LessonRow, locale));
}

export async function getRecentLessons(locale: Locale, take = 6): Promise<PublicLesson[]> {
  const rows = await prisma.lesson.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take,
    include: INCLUDE,
  });
  return rows.map((r) => toPublicLesson(r as LessonRow, locale));
}

/** Aggregate counts for homepage stats */
export async function getLibraryStats() {
  const [totalLessons, totalSeries, totalBooks, totalCategories, durationAgg] = await Promise.all([
    prisma.lesson.count({ where: { status: "PUBLISHED" } }),
    prisma.series.count({ where: { status: "PUBLISHED" } }),
    prisma.book.count({ where: { status: "PUBLISHED" } }),
    prisma.category.count(),
    prisma.lesson.aggregate({ where: { status: "PUBLISHED" }, _sum: { duration: true } }),
  ]);
  const totalSeconds = durationAgg._sum.duration ?? 0;
  return {
    totalLessons,
    totalSeries,
    totalBooks,
    totalCategories,
    totalAudioHours: Math.round(totalSeconds / 3600),
  };
}
