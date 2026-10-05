import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { getBookBySlug } from "@/server/books/queries";
import { getCategoryBySlug } from "@/server/categories/queries";
import { getSeriesBySlug } from "@/server/series/queries";
import { getLessonsByBook } from "@/server/lessons/queries";
import type { Locale } from "@/types/i18n";
import { BookOpen, Layers, Headphones, User, Tag, Clock, ChevronRight } from "lucide-react";
import { BookLessons } from "./BookTabs";

type Props = { params: Promise<{ locale: string; slug: string }> };

function totalDuration(lessons: { duration: number }[]) {
  const secs = lessons.reduce((a, l) => a + (l.duration ?? 0), 0);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function BookDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const l = locale as Locale;

  const tBook    = await getTranslations({ locale, namespace: "book" });
  const tNav     = await getTranslations({ locale, namespace: "nav" });
  const tActions = await getTranslations({ locale, namespace: "actions" });
  const tCat     = await getTranslations({ locale, namespace: "categories" });

  const book = await getBookBySlug(slug, l);
  if (!book) notFound();

  const [category, lessons] = await Promise.all([
    book.categoryId ? getCategoryBySlug(book.categoryId, l) : null,
    getLessonsByBook(book.id, l),
  ]);

  const series = book.seriesId ? await getSeriesBySlug(book.seriesId, l) : null;
  const duration = totalDuration(lessons);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Breadcrumbs items={[
        { label: tNav("books"), href: "/kutub" },
        ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : []),
        { label: book.title },
      ]} />

      {/* ── Book header ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Colored top bar */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-800 to-emerald-600" />

        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Book cover icon */}
            <div className="w-28 h-36 shrink-0 rounded-xl bg-gradient-to-br from-emerald-900/10 to-amber-900/10 dark:from-emerald-400/10 dark:to-amber-400/10 border border-stone-200 dark:border-stone-700 flex flex-col items-center justify-center gap-2 shadow-sm">
              <BookOpen className="w-10 h-10 text-emerald-800/50 dark:text-emerald-400/50" aria-hidden="true" />
              <span className="text-[10px] font-bold text-emerald-800/40 dark:text-emerald-400/40 uppercase tracking-wider text-center px-2 leading-tight">
                {category?.name ?? "Islamic Text"}
              </span>
            </div>

            {/* Book info */}
            <div className="flex-1 min-w-0">
              {/* Category */}
              {category && (
                <Link href={`/categories/${category.slug}`}
                  className="inline-flex items-center gap-1 mb-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider hover:underline">
                  <Tag className="w-3 h-3" aria-hidden="true" />
                  {category.name}
                </Link>
              )}

              {/* Title */}
              <h1 className="font-serif font-bold text-2xl sm:text-3xl text-stone-900 dark:text-stone-100 leading-tight mb-1">
                {book.title}
              </h1>

              {/* Author */}
              {book.author && (
                <p className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400 italic mb-4">
                  <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {book.author}
                </p>
              )}

              {/* Stats pills */}
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-600 dark:text-stone-300">
                  <Headphones className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  {lessons.length} {tCat("duruusCount")}
                </span>
                {lessons.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-600 dark:text-stone-300">
                    <Clock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    {duration}
                  </span>
                )}
              </div>

              {/* Go to series button */}
              {series && (
                <Link href={`/series/${series.slug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-900 dark:bg-emerald-800 text-amber-100 text-xs font-semibold hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-colors">
                  <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                  {tBook("goToSeries")}
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>

          {/* Description — About this book */}
          {book.description && (
            <div className="mt-6 pt-6 border-t border-stone-100 dark:border-stone-800">
              <h2 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
                About this book
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                {book.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Lessons ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif font-bold text-xl text-stone-900 dark:text-stone-100">
              Audio Lessons
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Explanation of {book.title} by Shaykh Muhammad Zain
            </p>
          </div>
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
            {lessons.length} lessons
          </span>
        </div>

        <BookLessons
          lessons={lessons}
          listenLabel={tActions("listen")}
          lessonsEmptyLabel={tBook("lessonsEmpty")}
        />
      </div>
    </div>
  );
}
