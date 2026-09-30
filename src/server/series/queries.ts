import "server-only";
import { prisma } from "@/lib/db";
import type { Locale } from "@/types/i18n";
import type { PublicSeries } from "@/types/library";

function resolveJson(json: unknown, locale: Locale): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const t = json as Record<string, string>;
  return t[locale] ?? t.en ?? undefined;
}

function toPublicSeries(
  row: {
    id: string;
    slug: string;
    title: string;
    translations: unknown;
    description: string | null;
    descTranslations: unknown;
    categoryId: string | null;
    bookId: string | null;
    coverImageKey: string | null;
    order: number;
    _count?: { lessons: number };
    category?: { name: string; slug: string; translations: unknown } | null;
    book?: { title: string; slug: string; translations: unknown } | null;
  },
  locale: Locale
): PublicSeries {
  return {
    id: row.id,
    slug: row.slug,
    title: resolveJson(row.translations, locale) ?? row.title,
    description: resolveJson(row.descTranslations, locale) ?? row.description ?? undefined,
    coverImageUrl: row.coverImageKey ?? undefined,
    categoryId: row.categoryId ?? undefined,
    categoryName: row.category ? (resolveJson(row.category.translations, locale) ?? row.category.name) : undefined,
    bookId: row.bookId ?? undefined,
    bookTitle: row.book ? (resolveJson(row.book.translations, locale) ?? row.book.title) : undefined,
    lessonCount: row._count?.lessons,
    order: row.order,
  };
}

export async function getPublishedSeries(locale: Locale, categoryId?: string): Promise<PublicSeries[]> {
  const rows = await prisma.series.findMany({
    where: { status: "PUBLISHED", ...(categoryId ? { categoryId } : {}) },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { lessons: true } },
      category: { select: { name: true, slug: true, translations: true } },
      book: { select: { title: true, slug: true, translations: true } },
    },
  });
  return rows.map((r) => toPublicSeries(r, locale));
}

export async function getSeriesBySlug(slug: string, locale: Locale): Promise<PublicSeries | null> {
  const row = await prisma.series.findUnique({
    where: { slug },
    include: {
      _count: { select: { lessons: true } },
      category: { select: { name: true, slug: true, translations: true } },
      book: { select: { title: true, slug: true, translations: true } },
    },
  });
  if (!row) return null;
  return toPublicSeries(row, locale);
}
