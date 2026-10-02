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
 * - Absolute URLs (http/https) → returned as-is (external/seed audio)
 * - Relative keys (audio/2026/file.mp3) → /api/media/audio/2026/file.mp3
 * - Empty string → empty string (no audio)
 */
function storageKeyToUrl(key: string | undefined | null): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  // Local storage key — serve via the media route
  return `/api/media/${key}`;
}

type LessonRow = Awaited<ReturnType<typeof prisma.lesson.findMany>>[0] & {
  category?: { name: string; slug: string; translations: unknown } | null;
  series?: { title: string; slug: string; translations: unknown } | null;
  book?: { title: string; slug: string; translations: unknown } | null;
  media?: { storageKey: string; mediaType: string }[];
  tags?: { tag: { slug: string } }[];
};

function toPublicLesson(row: LessonRow, locale: Locale): PublicLesson {
  const audioMedia = row.media?.find((m) => m.mediaType === "AUDIO");
  const pdfMedia = row.media?.find((m) => m.mediaType === "PDF");
  return {
    id: row.id,
    slug: row.slug,
    lessonNumber: row.lessonNumber ?? undefined,
    title: resolveJson(row.translations, locale) ?? row.title,
    description: resolveJson(row.descTranslations ?? {}, locale) ?? row.description ?? undefined,
    audioUrl: storageKeyToUrl(audioMedia?.storageKey),
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
    orderBy: { lessonNumber: "asc" },
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
