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
  // B2 key: s3://bucket/path/to/file → /api/media/b2/path/to/file
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
  return rows.map((r) => toPublicBook(r, locale));
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
  return toPublicBook(row, locale);
}
