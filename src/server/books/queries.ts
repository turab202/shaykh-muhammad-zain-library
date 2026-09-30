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
    media?: { storageKey: string; mediaType: string }[];
  },
  locale: Locale
): PublicBook {
  const pdfMedia = row.media?.find((m) => m.mediaType === "PDF");
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
    pdfUrl: pdfMedia?.storageKey,
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
      media: { select: { storageKey: true, mediaType: true } },
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
      media: { select: { storageKey: true, mediaType: true } },
    },
  });
  if (!row) return null;
  return toPublicBook(row, locale);
}
