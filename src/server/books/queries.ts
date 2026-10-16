import "server-only";
import { prisma } from "@/lib/db";
import type { Locale } from "@/types/i18n";
import type { PublicBook, TableOfContentsItem } from "@/types/library";

function resolveJson(json: unknown, locale: Locale): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const t = json as Record<string, string>;
  return t[locale] ?? t.en ?? undefined;
}

function parseToc(json: unknown, locale: Locale): TableOfContentsItem[] {
  if (!Array.isArray(json)) return [];
  return json.map((item: Record<string, unknown>) => ({
    chapter: Number(item.chapter ?? 0),
    title: resolveJson({ en: String(item.title ?? ""), ar: String(item.titleAr ?? "") }, locale) ?? String(item.title ?? ""),
    lessonId: item.lessonId ? String(item.lessonId) : undefined,
  }));
}

function storageKeyToUrl(key: string | undefined | null): string | undefined {
  if (!key) return undefined;
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  // B2 key: s3://bucket/path → /api/media/b2/path (redirect to pre-signed URL)
  // For PDFs we use the redirect (not presign JSON) since PDFs are opened in new tab
  if (key.startsWith("s3://")) {
    const objectKey = key.split("/").slice(3).join("/");
    return `/api/media/b2/${objectKey}`;
  }
  return `/api/media/${key}`;
}

function toPublicBook(
  row: {
    id: string;
    slug: string;
    title: string;
    translations: unknown;
    author: string | null;
    authorTranslations: unknown;
    description: string | null;
    descTranslations: unknown;
    categoryId: string | null;
    coverImageKey: string | null;
    tableOfContents: unknown;
    _count?: { lessons: number };
    category?: { name: string; slug: string; translations: unknown } | null;
    media?: { storageKey: string; mediaType: string; filename: string | null; size: number }[];
  },
  locale: Locale
): PublicBook {
  const pdfMedia = row.media?.find((m) => m.mediaType === "PDF");
  const pdfSizeKB = pdfMedia?.size ? Math.round(pdfMedia.size / 1024) : undefined;
  const pdfSizeMB = pdfSizeKB && pdfSizeKB > 1024 ? `${(pdfSizeKB / 1024).toFixed(1)} MB` : pdfSizeKB ? `${pdfSizeKB} KB` : undefined;
  return {
    id: row.id,
    slug: row.slug,
    title: resolveJson(row.translations, locale) ?? row.title,
    author: resolveJson(row.authorTranslations, locale) ?? row.author ?? undefined,
    description: resolveJson(row.descTranslations, locale) ?? row.description ?? undefined,
    categoryId: row.categoryId ?? undefined,
    categoryName: row.category ? (resolveJson(row.category.translations, locale) ?? row.category.name) : undefined,
    lessonCount: row._count?.lessons,
    pdfAvailable: !!pdfMedia,
    pdfUrl: storageKeyToUrl(pdfMedia?.storageKey),
    pdfSize: pdfSizeMB,
    coverImageUrl: storageKeyToUrl(row.coverImageKey) ?? undefined,
    tableOfContents: parseToc(row.tableOfContents, locale),
  };
}

export async function getPublishedBooks(locale: Locale, categoryId?: string): Promise<PublicBook[]> {
  const rows = await prisma.book.findMany({
    where: { status: "PUBLISHED", ...(categoryId ? { categoryId } : {}) },
    orderBy: { title: "asc" },
    include: {
      _count: { select: { lessons: true } },
      category: { select: { name: true, slug: true, translations: true } },
      media: { select: { storageKey: true, mediaType: true, filename: true, size: true } },
    },
  });

  // Also count lessons that come via series (series.bookId = book.id)
  // Many lessons have seriesId but not a direct bookId
  const bookIds = rows.map((r) => r.id);
  const seriesLessonCounts = bookIds.length
    ? await prisma.series.findMany({
        where: { bookId: { in: bookIds }, status: "PUBLISHED" },
        select: {
          bookId: true,
          _count: { select: { lessons: { where: { status: "PUBLISHED" } } } },
        },
      })
    : [];

  // Build map: bookId → total lessons via series
  const seriesCountMap = new Map<string, number>();
  for (const s of seriesLessonCounts) {
    if (!s.bookId) continue;
    seriesCountMap.set(s.bookId, (seriesCountMap.get(s.bookId) ?? 0) + s._count.lessons);
  }

  return rows.map((r) => {
    const book = toPublicBook(r, locale);
    // Use the higher of direct count vs via-series count
    const directCount = r._count?.lessons ?? 0;
    const seriesCount = seriesCountMap.get(r.id) ?? 0;
    return { ...book, lessonCount: Math.max(directCount, seriesCount) };
  });
}

export async function getBookBySlug(slug: string, locale: Locale): Promise<PublicBook | null> {
  const row = await prisma.book.findUnique({
    where: { slug },
    include: {
      _count: { select: { lessons: true } },
      category: { select: { name: true, slug: true, translations: true } },
      media: { select: { storageKey: true, mediaType: true, filename: true, size: true } },
    },
  });
  if (!row) return null;

  // Count lessons via series relationship (many lessons link via series, not direct bookId)
  const seriesLessonCount = await prisma.lesson.count({
    where: { status: "PUBLISHED", series: { bookId: row.id } },
  });

  const book = toPublicBook(row, locale);
  return { ...book, lessonCount: Math.max(row._count?.lessons ?? 0, seriesLessonCount) };
}
