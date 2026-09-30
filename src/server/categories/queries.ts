import "server-only";
import { prisma } from "@/lib/db";
import { resolveLocalized } from "@/types/i18n";
import type { Locale } from "@/types/i18n";
import type { PublicCategory } from "@/types/library";

/** Resolve a JSONB translations field for a given locale with English fallback. */
function resolveJson(json: unknown, locale: Locale): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const t = json as Record<string, string>;
  return t[locale] ?? t.en ?? undefined;
}

/** Map a Prisma Category row to a PublicCategory for the UI. */
function toPublicCategory(
  row: {
    id: string;
    slug: string;
    name: string;
    translations: unknown;
    description: string | null;
    descTranslations: unknown;
    icon: string | null;
    colorClass: string | null;
    _count?: { lessons: number; series: number; books: number };
  },
  locale: Locale
): PublicCategory {
  const name = resolveJson(row.translations, locale) ?? row.name;
  const description = resolveJson(row.descTranslations, locale) ?? row.description ?? undefined;
  return {
    id: row.id,
    slug: row.slug,
    name,
    description,
    icon: row.icon ?? undefined,
    colorClass: row.colorClass ?? undefined,
    lessonCount: row._count?.lessons,
    seriesCount: row._count?.series,
    bookCount: row._count?.books,
  };
}

export async function getPublishedCategories(locale: Locale): Promise<PublicCategory[]> {
  const rows = await prisma.category.findMany({
    where: { parentId: null }, // top-level only
    orderBy: { name: "asc" },
    include: {
      _count: { select: { lessons: true, series: true, books: true } },
    },
  });
  return rows.map((r) => toPublicCategory(r, locale));
}

export async function getCategoryBySlug(slug: string, locale: Locale): Promise<PublicCategory | null> {
  const row = await prisma.category.findUnique({
    where: { slug },
    include: {
      _count: { select: { lessons: true, series: true, books: true } },
    },
  });
  if (!row) return null;
  return toPublicCategory(row, locale);
}
