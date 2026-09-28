import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { SeriesCard } from "@/components/cards/SeriesCard";
import { BookCard } from "@/components/cards/BookCard";
import {
  getCatalogCategoryBySlug,
  getCatalogSeriesByCategory,
  getCatalogBooksByCategory,
  getCatalogLessonsBySeries,
} from "@/lib/fixtures/catalog";
import { Layers, BookOpen, Headphones, ArrowRight, Play } from "lucide-react";
import { CategoryPlayButton } from "./CategoryPlayButton";

// TEMPORARY — replace each fixture call with the matching Prisma query

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function CategoryDetailPage({ params }: Props) {
  const { locale, slug } = await params;

  const t = await getTranslations({ locale, namespace: "categories" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tCat = await getTranslations({ locale, namespace: "catalog" });
  const tSeries = await getTranslations({ locale, namespace: "series" });
  const tBook = await getTranslations({ locale, namespace: "book" });
  const tActions = await getTranslations({ locale, namespace: "actions" });
  const tCatDuruus = await getTranslations({ locale, namespace: "categories" });

  const category = getCatalogCategoryBySlug(slug);
  if (!category) notFound();

  const seriesList = getCatalogSeriesByCategory(category.id);
  const booksList = getCatalogBooksByCategory(category.id);
  const allLessons = seriesList.flatMap((s) => getCatalogLessonsBySeries(s.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs
        items={[
          { label: tNav("categories"), href: "/categories" },
          { label: category.name },
        ]}
      />

      {/* Hero banner */}
      <div className="bg-[var(--bg-surface)] dark:bg-[#111C16] border border-stone-200/90 dark:border-stone-800/90 rounded-2xl p-6 sm:p-8 lg:p-10 mb-10 shadow-sm relative overflow-hidden">
        <div
          className="absolute end-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-emerald-900/5 dark:bg-emerald-400/5 rounded-full blur-2xl pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-900 text-amber-100 flex items-center justify-center shadow-sm">
                <Layers className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
                  {tSeries("sacredScience")}
                </span>
                <span className="block text-xs text-stone-500 dark:text-stone-400">
                  {tSeries("structured")}
                </span>
              </div>
            </div>

            <h1 className="font-serif font-bold text-3xl sm:text-4xl text-stone-900 dark:text-stone-100 tracking-tight leading-tight mb-2">
              {category.name}
            </h1>

            {category.description && (
              <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed mb-6">
                {category.description}
              </p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-stone-700 dark:text-stone-300 border-t border-stone-200/80 dark:border-stone-800/80 pt-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
                <span className="font-semibold text-stone-900 dark:text-stone-100">{seriesList.length}</span>
                <span>{tSeries("seriesAndCollections")}</span>
              </div>
              <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">•</span>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
                <span className="font-semibold text-stone-900 dark:text-stone-100">{booksList.length}</span>
                <span>{tSeries("studiedBooks")}</span>
              </div>
              <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">•</span>
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
                <span className="font-semibold text-stone-900 dark:text-stone-100">{allLessons.length}</span>
                <span>{tSeries("catalogedLessons")}</span>
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <Link
              href="/categories"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-1.5"
            >
              {tSeries("allDisciplines")}
            </Link>
          </div>
        </div>
      </div>

      {/* Section 1: Series */}
      <section className="mb-14">
        <div className="flex items-end justify-between mb-6 pb-3 border-b border-stone-200/80 dark:border-stone-800/80">
          <div>
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
              {t("primaryCollections")}
            </span>
            <h2 className="font-serif font-bold text-2xl text-stone-900 dark:text-stone-100 mt-0.5">
              {t("seriesInCategory")}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-2xl">
              {t("seriesInCategorySubtitle")}
            </p>
          </div>
          <span className="text-xs font-medium text-stone-500 hidden sm:block">
            {seriesList.length} {tCatDuruus("seriesCount")}
          </span>
        </div>

        {seriesList.length === 0 ? (
          <div className="p-8 text-center bg-stone-50 dark:bg-stone-900/50 rounded-xl border border-stone-200 dark:border-stone-800">
            <Layers className="w-8 h-8 text-stone-400 mx-auto mb-2" aria-hidden="true" />
            <p className="text-xs text-stone-500">{tCat("noResults")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {seriesList.map((s) => {
              const seriesLessons = getCatalogLessonsBySeries(s.id);
              return (
                <div
                  key={s.id}
                  className="group flex flex-col bg-[var(--bg-surface)] dark:bg-[#111C16] border border-stone-200/80 dark:border-stone-800/80 rounded-2xl overflow-hidden hover:border-emerald-800/50 dark:hover:border-emerald-700/60 hover:shadow-md transition-all"
                >
                  {/* Cover placeholder */}
                  <div className="relative aspect-video bg-emerald-900/10 dark:bg-emerald-400/10 flex items-center justify-center">
                    <Layers className="w-8 h-8 text-emerald-800/20 dark:text-emerald-400/20" aria-hidden="true" />
                    <div className="absolute top-3 start-3">
                      <span className="px-2.5 py-1 rounded-md bg-stone-900/85 text-amber-100 text-[11px] font-medium flex items-center gap-1">
                        <Headphones className="w-3 h-3" aria-hidden="true" />
                        {s.lessonCount ?? 0} {tCatDuruus("duruusCount")}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors line-clamp-1 mb-1">
                      {s.title}
                    </h3>
                    {s.description && (
                      <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed mb-4 flex-1">
                        {s.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-stone-100 dark:border-stone-800">
                      <Link
                        href={`/series/${s.slug}`}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        {tSeries("exploreSeries")}
                        <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
                      </Link>
                      {seriesLessons.length > 0 && (
                        <CategoryPlayButton lesson={seriesLessons[0]} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Books */}
      {booksList.length > 0 && (
        <section className="mb-14">
          <div className="flex items-end justify-between mb-6 pb-3 border-b border-stone-200/80 dark:border-stone-800/80">
            <div>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
                {t("booksInCategory")}
              </span>
              <h2 className="font-serif font-bold text-2xl text-stone-900 dark:text-stone-100 mt-0.5">
                {t("booksInCategory")}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-2xl">
                {t("booksInCategorySubtitle")}
              </p>
            </div>
            <Link
              href="/kutub"
              className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              {tCat("allBooks")}
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {booksList.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                duruusLabel={tCatDuruus("duruusCount")}
                pdfLabel={tBook("pdfAvailable")}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Lesson directory */}
      <section>
        <div className="flex items-end justify-between mb-6 pb-3 border-b border-stone-200/80 dark:border-stone-800/80">
          <div>
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
              {t("lessonDirectoryEyebrow")}
            </span>
            <h2 className="font-serif font-bold text-2xl text-stone-900 dark:text-stone-100 mt-0.5">
              {t("lessonDirectoryTitle")}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-2xl">
              {t("lessonDirectorySubtitle")}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {seriesList.map((s) => {
            const seriesLessons = getCatalogLessonsBySeries(s.id);
            return (
              <div key={s.id} className="bg-[var(--bg-surface)] dark:bg-[#111C16] border border-stone-200/80 dark:border-stone-800/80 rounded-2xl overflow-hidden shadow-sm">
                {/* Series header */}
                <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-900/10 dark:bg-emerald-400/10 text-emerald-900 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                          {s.title}
                        </h3>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800">
                          {seriesLessons.length} {tCatDuruus("duruusCount")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/series/${s.slug}`}
                    className="hidden sm:inline-flex px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold items-center gap-1 transition-colors shrink-0"
                  >
                    {tSeries("goToSeries")}
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </div>

                {/* Lessons list */}
                {seriesLessons.length > 0 && (
                  <div className="border-t border-stone-200/80 dark:border-stone-800/80 divide-y divide-stone-200/60 dark:divide-stone-800/60">
                    {seriesLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                            {String(lesson.lessonNumber ?? 0).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/duruus/${lesson.slug}`}
                              className="font-serif font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 hover:text-emerald-900 dark:hover:text-emerald-400 transition-colors line-clamp-1 block"
                            >
                              {lesson.title}
                            </Link>
                            <span className="text-[11px] text-stone-400">
                              {formatDuration(lesson.duration)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <CategoryPlayButton lesson={lesson} />
                          <Link
                            href={`/duruus/${lesson.slug}`}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                            aria-label={tActions("listen")}
                          >
                            <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
