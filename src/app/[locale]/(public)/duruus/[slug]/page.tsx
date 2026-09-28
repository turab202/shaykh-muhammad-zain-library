import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { SeriesPlaylist } from "./SeriesPlaylist";
import {
  CATALOG_LESSONS,
  getCatalogSeriesBySlug,
  getCatalogCategoryBySlug,
  getCatalogBookBySlug,
} from "@/lib/fixtures/catalog";
import {
  BookOpen,
  Calendar,
  Clock,
  Layers,
  Send,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { isRtlLocale } from "@/types/i18n";
import type { Locale } from "@/types/i18n";

// TEMPORARY — replace fixture lookups with Prisma queries:
//   lesson   → prisma.lesson.findUnique({ where: { slug }, include: { series, category, book, media } })
//   siblings → prisma.lesson.findMany({ where: { seriesId, status: 'PUBLISHED' }, orderBy: { lessonNumber: 'asc' } })

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function LessonDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const isRtl = isRtlLocale(locale as Locale);

  const tLesson = await getTranslations({ locale, namespace: "lesson" });
  const tActions = await getTranslations({ locale, namespace: "actions" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tCat = await getTranslations({ locale, namespace: "categories" });

  // ── Look up lesson ────────────────────────────────────
  const lesson = CATALOG_LESSONS.find((l) => l.slug === slug);
  if (!lesson) notFound();

  // ── Related data ──────────────────────────────────────
  const series = lesson.seriesId
    ? getCatalogSeriesBySlug(lesson.seriesSlug ?? lesson.seriesId)
    : undefined;
  const category = lesson.categoryId
    ? getCatalogCategoryBySlug(lesson.categoryId)
    : undefined;
  const book = lesson.bookId
    ? getCatalogBookBySlug(lesson.bookId)
    : series?.bookId
    ? getCatalogBookBySlug(series.bookId)
    : undefined;

  // ── Prev / Next within same series ───────────────────
  const seriesLessons = series
    ? CATALOG_LESSONS.filter((l) => l.seriesId === series.id).sort(
        (a, b) => (a.lessonNumber ?? 0) - (b.lessonNumber ?? 0)
      )
    : [];
  const currentIndex = seriesLessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIndex > 0 ? seriesLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < seriesLessons.length - 1
      ? seriesLessons[currentIndex + 1]
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Breadcrumbs: Home → Category → Series → Lesson */}
      <Breadcrumbs
        items={[
          ...(category
            ? [{ label: category.name, href: `/categories/${category.slug}` }]
            : [{ label: tNav("categories"), href: "/categories" }]),
          ...(series
            ? [{ label: series.title, href: `/series/${series.slug}` }]
            : []),
          {
            label: `${tLesson("lessonPrefix")} ${lesson.lessonNumber ?? ""}`,
          },
        ]}
      />

      {/* Header card */}
      <div className="bg-[var(--bg-surface-elevated)] dark:bg-[#111C16] border border-stone-200/90 dark:border-stone-800/90 rounded-2xl p-6 sm:p-7 mb-8 shadow-sm">

        {/* Hierarchy breadcrumb chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-3">
          {category && (
            <Link
              href={`/categories/${category.slug}`}
              className="px-2.5 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-emerald-800 dark:text-emerald-400 font-semibold transition-colors flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              {category.name}
            </Link>
          )}

          {category && series && (
            <ChevronRight
              className={`w-3 h-3 text-stone-400 ${isRtl ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          )}

          {series && (
            <Link
              href={`/series/${series.slug}`}
              className="px-2.5 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
              {series.title}
            </Link>
          )}

          {book && (
            <>
              <ChevronRight
                className={`w-3 h-3 text-stone-400 ${isRtl ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
              <Link
                href={`/kutub/${book.slug}`}
                className="px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-medium hover:underline flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                {book.title}
              </Link>
            </>
          )}

          <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-900 text-amber-100 font-semibold ms-auto">
            #{String(lesson.lessonNumber ?? 0).padStart(3, "0")}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-serif font-bold text-2xl sm:text-3xl lg:text-4xl text-stone-900 dark:text-stone-100 leading-tight mb-3">
          {lesson.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 dark:text-stone-400 pt-3 border-t border-stone-200/60 dark:border-stone-800/60">
          {lesson.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              {lesson.publishedAt}
            </span>
          )}
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {formatDuration(lesson.duration)}
          </span>
          {series && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {tLesson("lessonPrefix")} {lesson.lessonNumber} {tLesson("of")}{" "}
                {series.lessonCount ?? seriesLessons.length}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Audio player — client island */}
      <div className="mb-10">
        <AudioPlayer lesson={lesson} />
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          {/* Summary + tags */}
          <div className="bg-[var(--bg-surface-elevated)] dark:bg-[#111C16] border border-stone-200 dark:border-stone-800 rounded-xl p-6 sm:p-7 shadow-sm">
            <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 mb-3">
              {tLesson("summary")}
            </h3>
            {lesson.description ? (
              <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                {lesson.description}
              </p>
            ) : null}

            {lesson.tags && lesson.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-stone-200/80 dark:border-stone-800/80 text-xs">
                <span className="text-stone-400 font-medium">
                  {tLesson("tags")}:
                </span>
                {lesson.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded text-[11px]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Materials */}
          <div className="bg-[var(--bg-surface-elevated)] dark:bg-[#111C16] border border-stone-200 dark:border-stone-800 rounded-xl p-6 sm:p-7 shadow-sm">
            <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
              {tLesson("materials")}
            </h3>

            <div className="space-y-3">
              {/* Audio item */}
              <div className="p-3.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-medium text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                      {tLesson("audioFile")}
                    </h4>
                    <span className="text-[11px] text-stone-400">
                      {formatDuration(lesson.duration)} · {tLesson("audioQuality")}
                    </span>
                  </div>
                </div>
                <a
                  href={lesson.audioUrl}
                  download={`Lesson_${lesson.lessonNumber ?? ""}.mp3`}
                  className="px-3 py-1.5 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {tActions("downloadAudio")}
                </a>
              </div>

              {/* Book / PDF item */}
              {book && (
                <div className="p-3.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="font-medium text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                        {tLesson("relatedBook")}: {book.title}
                      </h4>
                      <span className="text-[11px] text-stone-400">
                        {book.author}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/kutub/${book.slug}`}
                    className="px-3 py-1.5 rounded-md bg-emerald-900 hover:bg-emerald-800 text-amber-100 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    {tLesson("readBook")}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Previous / Next navigation */}
          <div className="grid grid-cols-2 gap-4">
            {prevLesson ? (
              <Link
                href={`/duruus/${prevLesson.slug}`}
                className="group p-4 bg-[var(--bg-surface-elevated)] dark:bg-[#111C16] border border-stone-200 dark:border-stone-800 rounded-xl hover:border-stone-300 dark:hover:border-stone-700 transition-colors flex flex-col justify-between"
              >
                <span className="text-[11px] font-semibold text-stone-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 flex items-center gap-1">
                  <ChevronLeft
                    className={`w-3.5 h-3.5 ${isRtl ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                  {tLesson("previous")}
                </span>
                <span className="font-serif font-bold text-xs sm:text-sm text-stone-800 dark:text-stone-200 line-clamp-1 mt-2">
                  #{prevLesson.lessonNumber}: {prevLesson.title}
                </span>
              </Link>
            ) : (
              <div />
            )}

            {nextLesson ? (
              <Link
                href={`/duruus/${nextLesson.slug}`}
                className="group p-4 bg-[var(--bg-surface-elevated)] dark:bg-[#111C16] border border-stone-200 dark:border-stone-800 rounded-xl hover:border-stone-300 dark:hover:border-stone-700 transition-colors flex flex-col justify-between text-end"
              >
                <span className="text-[11px] font-semibold text-stone-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 flex items-center justify-end gap-1">
                  {tLesson("next")}
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${isRtl ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
                <span className="font-serif font-bold text-xs sm:text-sm text-stone-800 dark:text-stone-200 line-clamp-1 mt-2">
                  #{nextLesson.lessonNumber}: {nextLesson.title}
                </span>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">

          {/* Telegram source provenance — static display, no client needed */}
          <div className="bg-[var(--bg-surface-elevated)] dark:bg-[#111C16] border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Send className="w-4 h-4" aria-hidden="true" />
              {tLesson("telegramSource")}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {tLesson("telegramPost")}
            </p>
            {/* Real Telegram metadata will populate here once TelegramMessage
                FK is added to Lesson and the importer is built. For now this
                section shows the archival context label only. */}
          </div>

          {/* Series playlist — client island (play buttons need AudioContext) */}
          {series && seriesLessons.length > 0 && (
            <SeriesPlaylist
              series={series}
              lessons={seriesLessons}
              activeLessonId={lesson.id}
              viewAllLabel={tActions("viewAll")}
              otherLessonsLabel={tLesson("otherLessons")}
              sequentialLabel={tLesson("sequentialLessons")}
              listenLabel={tActions("listen")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
