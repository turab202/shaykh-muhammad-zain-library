import "server-only";
import { prisma } from "@/lib/db";
import type { Locale } from "@/types/i18n";
import type { SearchResults } from "@/types/library";
import { getPublishedLessons } from "@/server/lessons/queries";
import { getPublishedSeries } from "@/server/series/queries";
import { getPublishedBooks } from "@/server/books/queries";
import { getPublishedCategories } from "@/server/categories/queries";

/**
 * Full-text search across all published content.
 * Uses PostgreSQL ILIKE for simplicity — upgrade to tsvector/GIN when
 * content volume grows.
 */
export async function searchLibrary(query: string, locale: Locale): Promise<SearchResults> {
  const q = query.trim();
  if (!q) {
    return { lessons: [], series: [], books: [], categories: [], totalCount: 0 };
  }

  const pattern = `%${q}%`;

  // Lessons: search title and description
  const lessonRows = await prisma.lesson.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        // JSONB search for translated titles
        { translations: { path: ["en"], string_contains: q } },
        { translations: { path: ["ar"], string_contains: q } },
        { translations: { path: ["am"], string_contains: q } },
      ],
    },
    take: 12,
    include: {
      category: { select: { name: true, slug: true, translations: true } },
      series: { select: { title: true, slug: true, translations: true } },
      book: { select: { title: true, slug: true, translations: true } },
      media: { select: { storageKey: true, mediaType: true } },
      tags: { include: { tag: { select: { slug: true } } } },
    },
    orderBy: { playCount: "desc" },
  });

  const seriesRows = await prisma.series.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { translations: { path: ["en"], string_contains: q } },
        { translations: { path: ["ar"], string_contains: q } },
        { translations: { path: ["am"], string_contains: q } },
      ],
    },
    take: 8,
    include: {
      _count: { select: { lessons: true } },
      category: { select: { name: true, slug: true, translations: true } },
      book: { select: { title: true, slug: true, translations: true } },
    },
    orderBy: { order: "asc" },
  });

  const bookRows = await prisma.book.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { author: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { translations: { path: ["en"], string_contains: q } },
        { translations: { path: ["ar"], string_contains: q } },
        { translations: { path: ["am"], string_contains: q } },
      ],
    },
    take: 8,
    include: {
      _count: { select: { lessons: true } },
      category: { select: { name: true, slug: true, translations: true } },
      media: { select: { storageKey: true, mediaType: true } },
    },
  });

  const categoryRows = await prisma.category.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { translations: { path: ["en"], string_contains: q } },
        { translations: { path: ["ar"], string_contains: q } },
        { translations: { path: ["am"], string_contains: q } },
      ],
    },
    take: 6,
    include: {
      _count: { select: { lessons: true, series: true, books: true } },
    },
  });

  // Reuse mapper functions via the query modules
  const { getPublishedLessons: _, ...rest } = await import("@/server/lessons/queries");

  // Manually resolve for search (lightweight inline resolution)
  function res(json: unknown, fallback: string): string {
    if (!json || typeof json !== "object") return fallback;
    const t = json as Record<string, string>;
    return t[locale] ?? t.en ?? fallback;
  }

  const lessons = lessonRows.map((r) => {
    const audio = (r.media as { storageKey: string; mediaType: string }[]).find((m) => m.mediaType === "AUDIO");
    const cat = r.category;
    const ser = r.series;
    const bk = r.book;
    return {
      id: r.id, slug: r.slug, lessonNumber: r.lessonNumber ?? undefined,
      title: res(r.translations, r.title),
      audioUrl: audio?.storageKey ?? "",
      duration: r.duration ?? 0,
      publishedAt: r.publishedAt?.toISOString().split("T")[0],
      categoryId: r.categoryId ?? undefined,
      categoryName: cat ? res(cat.translations, cat.name) : undefined,
      seriesId: r.seriesId ?? undefined,
      seriesTitle: ser ? res(ser.translations, ser.title) : undefined,
      seriesSlug: ser?.slug,
      bookId: r.bookId ?? undefined,
      bookTitle: bk ? res(bk.translations, bk.title) : undefined,
      bookSlug: bk?.slug,
      tags: (r.tags as { tag: { slug: string } }[]).map((t) => t.tag.slug),
      playCount: r.playCount,
    };
  });

  const series = seriesRows.map((r) => ({
    id: r.id, slug: r.slug,
    title: res(r.translations, r.title),
    description: r.description ?? undefined,
    categoryId: r.categoryId ?? undefined,
    categoryName: r.category ? res(r.category.translations, r.category.name) : undefined,
    bookId: r.bookId ?? undefined,
    lessonCount: (r._count as { lessons: number }).lessons,
    order: r.order,
  }));

  const books = bookRows.map((r) => {
    const pdf = (r.media as { storageKey: string; mediaType: string }[]).find((m) => m.mediaType === "PDF");
    return {
      id: r.id, slug: r.slug,
      title: res(r.translations, r.title),
      author: r.author ?? undefined,
      description: r.description ?? undefined,
      categoryId: r.categoryId ?? undefined,
      categoryName: r.category ? res(r.category.translations, r.category.name) : undefined,
      lessonCount: (r._count as { lessons: number }).lessons,
      pdfAvailable: !!pdf,
      pdfUrl: pdf?.storageKey,
    };
  });

  const categories = categoryRows.map((r) => ({
    id: r.id, slug: r.slug,
    name: res(r.translations, r.name),
    icon: r.icon ?? undefined,
    colorClass: r.colorClass ?? undefined,
    lessonCount: (r._count as { lessons: number; series: number; books: number }).lessons,
    seriesCount: (r._count as { lessons: number; series: number; books: number }).series,
    bookCount: (r._count as { lessons: number; series: number; books: number }).books,
  }));

  return {
    lessons,
    series,
    books,
    categories,
    totalCount: lessons.length + series.length + books.length + categories.length,
  };
}
