import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { getBookBySlug } from "@/server/books/queries";
import { getCategoryBySlug } from "@/server/categories/queries";
import { getSeriesBySlug } from "@/server/series/queries";
import { getLessonsByBook } from "@/server/lessons/queries";
import type { Locale } from "@/types/i18n";
import { BookOpen, Layers, Headphones, User } from "lucide-react";
import { BookLessons } from "./BookTabs";

type Props = { params: Promise<{ locale: string; slug: string }> };

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Breadcrumbs items={[
        { label: tNav("books"), href: "/kutub" },
        ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : []),
        { label: book.title },
      ]} />

      {/* Book header card */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-6 items-start">

          {/* Cover icon */}
          <div className="w-24 h-32 sm:w-28 sm:h-36 shrink-0 rounded-xl bg-emerald-900/10 dark:bg-emerald-400/10 flex items-center justify-center border border-stone-200 dark:border-stone-700">
            <BookOpen className="w-10 h-10 text-emerald-800/40 dark:text-emerald-400/40" aria-hidden="true" />
          </div>

          {/* Book info */}
          <div className="flex-1 min-w-0">
            {/* Category badge */}
            {category && (
              <Link
                href={`/categories/${category.slug}`}
                className="inline-block mb-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider hover:underline"
              >
                {category.name}
              </Link>
            )}

            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-stone-900 dark:text-stone-100 leading-tight mb-2">
              {book.title}
            </h1>

            {book.author && (
              <p className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400 italic mb-4">
                <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {book.author}
              </p>
            )}

            {book.description && (
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-5">
                {book.description}
              </p>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 dark:text-stone-400 mb-5">
              <span className="flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                <strong className="text-stone-800 dark:text-stone-200">{lessons.length}</strong>
                {" "}{tCat("duruusCount")}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {series && (
                <Link
                  href={`/series/${series.slug}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-900 dark:bg-emerald-800 text-amber-100 text-xs font-semibold hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                  {tBook("goToSeries")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lessons section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif font-bold text-xl text-stone-900 dark:text-stone-100">
            {tBook("tabAudio")}
            <span className="ms-2 text-sm font-normal text-stone-400">({lessons.length})</span>
          </h2>
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
