/**
 * TEMPORARY FIXTURES — Catalog pages
 *
 * Typed static snapshots for categories, series, and books while the
 * database is not yet populated. All objects match our Prisma-resolved
 * UI types so replacing with real queries is a one-line swap per page.
 *
 * TO REPLACE:
 *   CATALOG_CATEGORIES → prisma.category.findMany({ orderBy: { name: 'asc' } })
 *   CATALOG_SERIES     → prisma.series.findMany({ where: { status: 'PUBLISHED' }, orderBy: { order: 'asc' } })
 *   CATALOG_BOOKS      → prisma.book.findMany({ where: { status: 'PUBLISHED' } })
 *
 * Do NOT import this file from client components.
 * Do NOT add business logic here.
 */

import type { PublicCategory, PublicSeries, PublicBook } from "@/types/library";
import {
  HOMEPAGE_CATEGORIES,
  HOMEPAGE_SERIES,
  HOMEPAGE_LESSONS,
} from "./homepage";

// ─── Re-export homepage fixtures under catalog names ─────
export const CATALOG_CATEGORIES: PublicCategory[] = HOMEPAGE_CATEGORIES;
export const CATALOG_SERIES: PublicSeries[] = HOMEPAGE_SERIES;
export { HOMEPAGE_LESSONS as CATALOG_LESSONS };

// ─── Books ───────────────────────────────────────────────

export const CATALOG_BOOKS: PublicBook[] = [
  {
    id: "book-riyad-as-salihin",
    slug: "riyad-as-salihin",
    title: "Riyāḍ aṣ-Ṣāliḥīn",
    author: "Imam Yaḥyā ibn Sharaf al-Nawawī (631–676 AH)",
    description:
      "A comprehensive hadith collection organised around themes of piety and righteous conduct, widely studied across the Islamic world.",
    categoryId: "hadith",
    categoryName: "Hadith Sciences",
    seriesId: "series-riyad-as-salihin",
    seriesTitle: "Riyāḍ aṣ-Ṣāliḥīn",
    lessonCount: 42,
    pdfAvailable: true,
    pdfPages: 684,
    pdfSize: "14.2 MB",
    tableOfContents: [
      { chapter: 1, title: "Sincerity & Intention" },
      { chapter: 2, title: "Repentance" },
      { chapter: 3, title: "Patience & Perseverance" },
      { chapter: 4, title: "Truthfulness" },
      { chapter: 5, title: "Guardianship of Orphans" },
    ],
  },
  {
    id: "book-tafsir-ibn-kathir",
    slug: "tafsir-ibn-kathir",
    title: "Tafsīr Ibn Kathīr",
    author: "Imam Ismāʿīl ibn ʿUmar Ibn Kathīr (701–774 AH)",
    description:
      "One of the most authoritative Quranic commentaries, known for its reliance on authentic narrations and clear exegetical method.",
    categoryId: "tafsir",
    categoryName: "Tafsir",
    seriesId: "series-tafsir-ibn-kathir",
    seriesTitle: "Tafsīr Ibn Kathīr",
    lessonCount: 38,
    pdfAvailable: true,
    pdfPages: 1420,
    pdfSize: "42.7 MB",
    tableOfContents: [
      { chapter: 1, title: "Surah Al-Fatihah" },
      { chapter: 2, title: "Surah Al-Baqarah" },
      { chapter: 3, title: "Surah Āl ʿImrān" },
      { chapter: 4, title: "Surah An-Nisāʾ" },
    ],
  },
  {
    id: "book-aqeedah-wasitiyyah",
    slug: "al-aqeedah-al-wasitiyyah",
    title: "Al-ʿAqīdah Al-Wāsiṭiyyah",
    author: "Shaykh al-Islām Ibn Taymiyyah (661–728 AH)",
    description:
      "A concise treatise outlining the correct Sunni creed regarding the Names and Attributes of Allah and related matters of theology.",
    categoryId: "aqeedah",
    categoryName: "Aqeedah",
    seriesId: "series-al-aqeedah-al-wasitiyyah",
    seriesTitle: "Al-Aqeedah Al-Wāsiṭiyyah",
    lessonCount: 22,
    pdfAvailable: true,
    pdfPages: 96,
    pdfSize: "3.1 MB",
    tableOfContents: [
      { chapter: 1, title: "Introduction & Author's Preface" },
      { chapter: 2, title: "Belief in Allah's Names & Attributes" },
      { chapter: 3, title: "The Way of Ahlus-Sunnah" },
    ],
  },
  {
    id: "book-al-ajrumiyyah",
    slug: "al-ajrumiyyah",
    title: "Al-Muqaddimah Al-Ājurrūmiyyah",
    author: "Ibn Ājarrūm al-Ṣanhājī (672–723 AH)",
    description:
      "The most widely studied classical primer on Arabic grammar, covering the essential principles of iʿrāb in concise format.",
    categoryId: "arabic",
    categoryName: "Arabic Language",
    seriesId: "series-al-ajrumiyyah",
    seriesTitle: "Al-Ājurrūmiyyah",
    lessonCount: 18,
    pdfAvailable: true,
    pdfPages: 48,
    pdfSize: "1.9 MB",
    tableOfContents: [
      { chapter: 1, title: "Types of Speech (Kalām)" },
      { chapter: 2, title: "Signs of Iʿrāb" },
      { chapter: 3, title: "The Nominative (Marfūʿāt)" },
      { chapter: 4, title: "The Accusative (Manṣūbāt)" },
      { chapter: 5, title: "The Genitive (Makhfūḍāt)" },
    ],
  },
];

// ─── Lookup helpers ───────────────────────────────────────

export function getCatalogCategoryBySlug(
  slug: string
): PublicCategory | undefined {
  return CATALOG_CATEGORIES.find((c) => c.slug === slug);
}

export function getCatalogSeriesBySlug(
  slug: string
): PublicSeries | undefined {
  return CATALOG_SERIES.find((s) => s.slug === slug);
}

export function getCatalogBookBySlug(slug: string): PublicBook | undefined {
  return CATALOG_BOOKS.find((b) => b.slug === slug);
}

export function getCatalogSeriesByCategory(
  categoryId: string
): PublicSeries[] {
  return CATALOG_SERIES.filter((s) => s.categoryId === categoryId);
}

export function getCatalogBooksByCategory(categoryId: string): PublicBook[] {
  return CATALOG_BOOKS.filter((b) => b.categoryId === categoryId);
}

export function getCatalogLessonsBySeries(seriesId: string) {
  return HOMEPAGE_LESSONS.filter((l) => l.seriesId === seriesId);
}

export function getCatalogLessonsByBook(bookId: string) {
  return HOMEPAGE_LESSONS.filter((l) => l.bookId === bookId);
}
