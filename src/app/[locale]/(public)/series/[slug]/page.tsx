import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { getSeriesBySlug } from "@/server/series/queries";

export const revalidate = 600;

import { getCategoryBySlug } from "@/server/categories/queries";
import { getBookBySlug } from "@/server/books/queries";
import { getLessonsBySeries } from "@/server/lessons/queries";
import type { Locale } from "@/types/i18n";
import { isRtlLocale } from "@/types/i18n";
import { Layers, BookOpen, FileText, Clock, ArrowRight, Headphones } from "lucide-react";
import { SeriesAudioControls } from "./SeriesAudioControls";
import { LessonPlayButton } from "./LessonPlayButton";

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function SeriesDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const l = locale as Locale;
  const isRtl = isRtlLocale(l);

  const tSeries  = await getTranslations({ locale, namespace: "series" });
  const tNav     = await getTranslations({ locale, namespace: "nav" });
  const tActions = await getTranslations({ locale, namespace: "actions" });
  const tCat     = await getTranslations({ locale, namespace: "categories" });
  const tBook    = await getTranslations({ locale, namespace: "book" });

  const series = await getSeriesBySlug(slug, l);
  if (!series) notFound();

  const [category, book, lessons] = await Promise.all([
    series.categoryId ? getCategoryBySlug(series.categoryId, l) : null,
    series.bookId ? getBookBySlug(series.bookId, l) : null,
    getLessonsBySeries(series.id, l),
  ]);

  const durationHours = series.totalDuration ? Math.round(series.totalDuration / 3600) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : [{ label: tNav("series"), href: "/series" }]),
        { label: series.title },
      ]} />

      {/* Hero */}
      <div className="bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] border border-stone-200/90 dark:border-stone-800/90 rounded-2xl overflow-hidden shadow-sm mb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 sm:p-8 items-center">
          <div className="md:col-span-4 relative aspect-[4/3] rounded-xl overflow-hidden bg-emerald-900/10 dark:bg-emerald-400/10 flex items-center justify-center shadow-sm">
            <Layers className="w-12 h-12 text-emerald-800/20 dark:text-emerald-400/20" aria-hidden="true" />
          </div>
          <div className="md:col-span-8 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-2">
                {category && (<><Link href={`/categories/${category.slug}`} className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline">{category.name}</Link><span aria-hidden="true">·</span></>)}
                <span>{lessons.length} {tCat("duruusCount")}</span>
                {durationHours && (<><span aria-hidden="true">·</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden="true" />{durationHours}h total</span></>)}
              </div>
              <h1 className="font-serif font-bold text-2xl sm:text-3xl text-stone-900 dark:text-stone-100 leading-tight mb-3">{series.title}</h1>
              {book && <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400 mb-3"><span className="font-semibold text-stone-800 dark:text-stone-200">{tBook("author")}:</span><span className="italic">{book.author}</span></div>}
              {series.description && <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{series.description}</p>}
            </div>
            <SeriesAudioControls lessons={lessons} startLabel={tSeries("startListening")} bookSlug={book?.slug} bookLabel={tBook("tabReader")} />
          </div>
        </div>
      </div>

      {/* Linked book */}
      {book && (
        <div className="bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 mb-10 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">{tBook("tabReader")}</span>
                <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 mt-0.5">{book.title}</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {book.author}{book.pdfSize ? ` · ${book.pdfSize}` : ""}
                  {book.pdfAvailable && <span className="ml-2 text-amber-700 dark:text-amber-400 font-medium">PDF available</span>}
                </p>
              </div>
            </div>
            <Link href={`/kutub/${book.slug}`} className="px-4 py-2 bg-emerald-900 hover:bg-emerald-800 text-amber-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shrink-0">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              Open Book
            </Link>
          </div>
        </div>
      )}

      {/* Lessons list */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <h3 className="font-serif font-bold text-xl text-stone-900 dark:text-stone-100">
              Audio Lessons
            </h3>
          </div>
          <span className="text-sm text-stone-500 dark:text-stone-400">{lessons.length} lessons</span>
        </div>

        <div className="bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden divide-y divide-stone-200/70 dark:divide-stone-800/70">
          {lessons.length === 0 ? (
            <p className="p-6 text-sm text-stone-500">{tSeries("noSeriesFound")}</p>
          ) : lessons.map((lesson) => (
            <div key={lesson.id} className="p-4 sm:p-5 flex items-center gap-4 hover:bg-stone-50 dark:hover:bg-stone-900/40 transition-colors">
              {/* Number badge */}
              <div className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                {String(lesson.lessonNumber ?? 0).padStart(2, "0")}
              </div>

              {/* Title area — takes full width */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/duruus/${lesson.slug}`}
                  className="font-medium text-sm sm:text-base hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors line-clamp-1 block text-stone-900 dark:text-stone-100"
                >
                  {/* Show description (surah/topic) as primary, title as fallback */}
                  {lesson.description ?? (lesson.displayTitle ?? lesson.title)}
                </Link>
                <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  {(lesson.duration ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {fmt(lesson.duration)}
                    </span>
                  )}
                  {lesson.publishedAt && (
                    <><span aria-hidden="true">·</span><span>{lesson.publishedAt}</span></>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <LessonPlayButton lesson={lesson} listenLabel={tActions("listen")} />
                <Link
                  href={`/duruus/${lesson.slug}`}
                  className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
                  aria-label="View lesson"
                >
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmt(s: number): string {
  if (!s || s <= 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}
