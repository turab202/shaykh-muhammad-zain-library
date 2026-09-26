/**
 * UI-level domain types for public-facing components.
 *
 * These types describe the shape of data that Server Components resolve
 * (from Prisma queries or temporary fixtures) and pass down as props to
 * Client Components. They are NOT the Prisma-generated database types —
 * those live in src/generated/prisma/client.
 *
 * Multilingual fields follow the LocalizedText pattern { en?, ar?, am? }
 * matching the JSONB columns in the Prisma schema. Server Components use
 * resolveLocalized() from @/types/i18n to pick the right string before
 * passing it as a resolved prop, so most Client Components just receive
 * plain strings and do not need to know the source language.
 */

// ─────────────────────────────────────────────────────────
// Primitive re-exports
// ─────────────────────────────────────────────────────────

export type { LocalizedText, Locale } from "./i18n";

// ─────────────────────────────────────────────────────────
// Content status
// ─────────────────────────────────────────────────────────

/** Maps to the Prisma ContentStatus enum. */
export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// ─────────────────────────────────────────────────────────
// Category
// ─────────────────────────────────────────────────────────

/**
 * Resolved category for UI rendering.
 * name/description are pre-resolved for the current locale.
 */
export interface PublicCategory {
  id: string;
  slug: string;
  /** Display name resolved for the current locale. */
  name: string;
  /** Description resolved for the current locale. */
  description?: string;
  /** Lucide icon name string, e.g. "BookOpen". Stored as Category.icon in DB. */
  icon?: string;
  /** Tailwind colour class, e.g. "bg-amber-50 text-amber-700". */
  colorClass?: string;
  /** Denormalised counts — computed at query time. */
  lessonCount?: number;
  seriesCount?: number;
  bookCount?: number;
}

// ─────────────────────────────────────────────────────────
// Series
// ─────────────────────────────────────────────────────────

/** Resolved series for UI rendering. */
export interface PublicSeries {
  id: string;
  slug: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  categoryId?: string;
  categoryName?: string;
  /** Linked book, if any. */
  bookId?: string;
  bookTitle?: string;
  /** Denormalised counts. */
  lessonCount?: number;
  /** Total duration in seconds. */
  totalDuration?: number;
  /** Display order. */
  order?: number;
}

// ─────────────────────────────────────────────────────────
// Book
// ─────────────────────────────────────────────────────────

export interface TableOfContentsItem {
  chapter: number;
  title: string;
  /** The lesson this chapter links to, if mapped. */
  lessonId?: string;
  lessonSlug?: string;
}

/** Resolved book for UI rendering. */
export interface PublicBook {
  id: string;
  slug: string;
  title: string;
  author?: string;
  description?: string;
  coverImageUrl?: string;
  categoryId?: string;
  categoryName?: string;
  /** Linked series, if any. */
  seriesId?: string;
  seriesTitle?: string;
  /** Denormalised count. */
  lessonCount?: number;
  /** PDF metadata — sourced from the Media table when available. */
  pdfAvailable?: boolean;
  pdfPages?: number;
  pdfSize?: string;
  pdfUrl?: string;
  tableOfContents?: TableOfContentsItem[];
}

// ─────────────────────────────────────────────────────────
// Lesson
// ─────────────────────────────────────────────────────────

/**
 * Resolved lesson for UI rendering and AudioContext.
 *
 * audioUrl is the resolved media URL from the Media table.
 * In temporary fixtures it points to a sample MP3 — this will be
 * replaced by a real storage URL once Media records exist.
 */
export interface PublicLesson {
  id: string;
  slug: string;
  lessonNumber?: number;
  title: string;
  description?: string;
  /** Audio file URL. Resolved from the Media table (storageKey → URL). */
  audioUrl: string;
  /** Optional PDF attachment URL. */
  pdfUrl?: string;
  /** Duration in seconds. */
  duration: number;
  /** ISO date string. */
  publishedAt?: string;
  categoryId?: string;
  categoryName?: string;
  seriesId?: string;
  seriesTitle?: string;
  seriesSlug?: string;
  bookId?: string;
  bookTitle?: string;
  bookSlug?: string;
  tags?: string[];
  /** Play count for sorting popular lessons. */
  playCount?: number;
}

// ─────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────

export interface SearchFilters {
  query: string;
  categoryId?: string;
  seriesId?: string;
  bookId?: string;
  type?: "all" | "lessons" | "series" | "books";
}

export interface LessonFilters {
  searchQuery?: string;
  categoryId?: string;
  seriesId?: string;
  bookId?: string;
  durationRange?: "all" | "short" | "medium" | "long";
  sortBy?: "newest" | "oldest" | "lesson_number" | "title";
}

export interface SearchResults {
  lessons: PublicLesson[];
  series: PublicSeries[];
  books: PublicBook[];
  categories: PublicCategory[];
  totalCount: number;
}
