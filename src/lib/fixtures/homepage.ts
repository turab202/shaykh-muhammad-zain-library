/**
 * TEMPORARY FIXTURES — Homepage
 *
 * These are static typed snapshots used while the database is not yet
 * populated. Every object here matches the shape of our Prisma-resolved
 * UI types (PublicCategory, PublicSeries, PublicLesson) so the migration
 * to real Prisma queries is a one-line import swap per section.
 *
 * TO REPLACE: swap each export with a Prisma Server Component query in
 * src/server/{categories,series,lessons}/ and delete this file.
 *
 * Do NOT import this file from client components.
 * Do NOT add business logic here.
 * Do NOT expand this file beyond homepage needs.
 */

import type { PublicCategory, PublicSeries, PublicLesson } from "@/types/library";

// ─── Stats ───────────────────────────────────────────────
// Replace with: prisma.lesson.count(), etc.

export const HOMEPAGE_STATS = {
  totalLessons: 0,
  totalSeries: 0,
  totalBooks: 0,
  totalAudioHours: 0,
  totalCategories: 0,
} as const;

// ─── Categories ──────────────────────────────────────────
// Replace with: prisma.category.findMany({ take: 8, orderBy: … })

export const HOMEPAGE_CATEGORIES: PublicCategory[] = [
  {
    id: "hadith",
    slug: "hadith",
    name: "Hadith Sciences",
    description: "Study of the sayings and traditions of the Prophet ﷺ",
    icon: "BookOpen",
    colorClass: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  },
  {
    id: "tafsir",
    slug: "tafsir",
    name: "Tafsir",
    description: "Quranic exegesis and commentary",
    icon: "Scroll",
    colorClass: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  {
    id: "aqeedah",
    slug: "aqeedah",
    name: "Aqeedah",
    description: "Islamic creed and theology",
    icon: "Shield",
    colorClass: "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  },
  {
    id: "fiqh",
    slug: "fiqh",
    name: "Fiqh",
    description: "Islamic jurisprudence and law",
    icon: "Scale",
    colorClass: "bg-purple-50 text-purple-800 dark:bg-purple-950/30 dark:text-purple-300",
  },
  {
    id: "arabic",
    slug: "arabic",
    name: "Arabic Language",
    description: "Arabic grammar, morphology and linguistics",
    icon: "Languages",
    colorClass: "bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300",
  },
  {
    id: "seerah",
    slug: "seerah",
    name: "Seerah",
    description: "Biography of the Prophet ﷺ",
    icon: "Star",
    colorClass: "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300",
  },
  {
    id: "adab",
    slug: "adab",
    name: "Adab",
    description: "Islamic manners, etiquette and character",
    icon: "Heart",
    colorClass: "bg-teal-50 text-teal-800 dark:bg-teal-950/30 dark:text-teal-300",
  },
  {
    id: "usul",
    slug: "usul",
    name: "Usul al-Fiqh",
    description: "Principles of Islamic jurisprudence",
    icon: "Layers",
    colorClass: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300",
  },
];

// ─── Featured Series ─────────────────────────────────────
// Replace with: prisma.series.findMany({ where: { status: 'PUBLISHED' }, take: 4, orderBy: { order: 'asc' } })

export const HOMEPAGE_SERIES: PublicSeries[] = [
  {
    id: "series-riyad-as-salihin",
    slug: "riyad-as-salihin",
    title: "Riyāḍ aṣ-Ṣāliḥīn",
    description: "A comprehensive study of the well-known hadith collection of Imam al-Nawawi",
    categoryId: "hadith",
    categoryName: "Hadith Sciences",
    lessonCount: 42,
    totalDuration: 90720,
    order: 1,
  },
  {
    id: "series-tafsir-ibn-kathir",
    slug: "tafsir-ibn-kathir",
    title: "Tafsīr Ibn Kathīr",
    description: "Explanation of the Noble Quran following the classical tafsir methodology",
    categoryId: "tafsir",
    categoryName: "Tafsir",
    lessonCount: 38,
    totalDuration: 136800,
    order: 2,
  },
  {
    id: "series-al-aqeedah-al-wasitiyyah",
    slug: "al-aqeedah-al-wasitiyyah",
    title: "Al-Aqeedah Al-Wāsiṭiyyah",
    description: "Study of Ibn Taymiyyah's foundational text on Islamic creed",
    categoryId: "aqeedah",
    categoryName: "Aqeedah",
    lessonCount: 22,
    totalDuration: 47520,
    order: 3,
  },
  {
    id: "series-al-ajrumiyyah",
    slug: "al-ajrumiyyah",
    title: "Al-Ājurrūmiyyah",
    description: "Classical Arabic grammar through the famous introductory primer",
    categoryId: "arabic",
    categoryName: "Arabic Language",
    lessonCount: 18,
    totalDuration: 32400,
    order: 4,
  },
];

// ─── Recent Lessons ──────────────────────────────────────
// Replace with: prisma.lesson.findMany({ where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' }, take: 6, include: { series: true, category: true } })

export const HOMEPAGE_LESSONS: PublicLesson[] = [
  {
    id: "duruus-riyad-001",
    slug: "riyad-as-salihin-lesson-1",
    lessonNumber: 1,
    title: "Introduction to Riyāḍ aṣ-Ṣāliḥīn",
    description: "Opening lesson covering the biography of Imam al-Nawawi and the importance of this collection",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 2540,
    publishedAt: "2024-01-10",
    categoryId: "hadith",
    categoryName: "Hadith Sciences",
    seriesId: "series-riyad-as-salihin",
    seriesTitle: "Riyāḍ aṣ-Ṣāliḥīn",
    seriesSlug: "riyad-as-salihin",
    tags: ["hadith", "nawawi"],
  },
  {
    id: "duruus-tafsir-001",
    slug: "tafsir-ibn-kathir-lesson-1",
    lessonNumber: 1,
    title: "Tafsir of Surah Al-Fatihah",
    description: "Detailed explanation of the Opening Chapter of the Quran according to Ibn Kathir",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    duration: 3100,
    publishedAt: "2024-01-08",
    categoryId: "tafsir",
    categoryName: "Tafsir",
    seriesId: "series-tafsir-ibn-kathir",
    seriesTitle: "Tafsīr Ibn Kathīr",
    seriesSlug: "tafsir-ibn-kathir",
    tags: ["tafsir", "quran"],
  },
  {
    id: "duruus-wasitiyyah-001",
    slug: "al-aqeedah-al-wasitiyyah-lesson-1",
    lessonNumber: 1,
    title: "Introduction to Al-Wāsiṭiyyah",
    description: "Overview of Ibn Taymiyyah's treatise on the correct Islamic creed",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    duration: 3150,
    publishedAt: "2024-01-05",
    categoryId: "aqeedah",
    categoryName: "Aqeedah",
    seriesId: "series-al-aqeedah-al-wasitiyyah",
    seriesTitle: "Al-Aqeedah Al-Wāsiṭiyyah",
    seriesSlug: "al-aqeedah-al-wasitiyyah",
    tags: ["aqeedah", "ibn taymiyyah"],
  },
  {
    id: "duruus-ajrum-001",
    slug: "al-ajrumiyyah-lesson-1",
    lessonNumber: 1,
    title: "Introduction to Al-Ājurrūmiyyah",
    description: "First lesson in the classical Arabic grammar primer",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 2160,
    publishedAt: "2024-01-09",
    categoryId: "arabic",
    categoryName: "Arabic Language",
    seriesId: "series-al-ajrumiyyah",
    seriesTitle: "Al-Ājurrūmiyyah",
    seriesSlug: "al-ajrumiyyah",
    tags: ["arabic", "grammar"],
  },
  {
    id: "duruus-riyad-002",
    slug: "riyad-as-salihin-lesson-2",
    lessonNumber: 2,
    title: "Chapter of Sincerity — Part 1",
    description: "Study of the first chapter on the sincerity of intention",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    duration: 2700,
    publishedAt: "2024-01-12",
    categoryId: "hadith",
    categoryName: "Hadith Sciences",
    seriesId: "series-riyad-as-salihin",
    seriesTitle: "Riyāḍ aṣ-Ṣāliḥīn",
    seriesSlug: "riyad-as-salihin",
    tags: ["hadith", "ikhlas"],
  },
  {
    id: "duruus-tafsir-002",
    slug: "tafsir-ibn-kathir-lesson-2",
    lessonNumber: 2,
    title: "Tafsir of Surah Al-Baqarah — Part 1",
    description: "Beginning of the explanation of the longest chapter of the Quran",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    duration: 3840,
    publishedAt: "2024-01-15",
    categoryId: "tafsir",
    categoryName: "Tafsir",
    seriesId: "series-tafsir-ibn-kathir",
    seriesTitle: "Tafsīr Ibn Kathīr",
    seriesSlug: "tafsir-ibn-kathir",
    tags: ["tafsir", "baqarah"],
  },
];
