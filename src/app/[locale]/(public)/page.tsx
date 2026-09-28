import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isRtlLocale } from "@/types/i18n";
import type { Locale } from "@/types/i18n";
import {
  HOMEPAGE_STATS,
  HOMEPAGE_CATEGORIES,
  HOMEPAGE_SERIES,
  HOMEPAGE_LESSONS,
} from "@/lib/fixtures/homepage";
import {
  Search,
  Headphones,
  Layers,
  FileText,
  ArrowRight,
  Send,
  Compass,
  Clock,
  BookOpen,
} from "lucide-react";

// TEMPORARY — replace with Prisma query when database is seeded:
// const stats = await prisma.lesson.count() etc.

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const isRtl = isRtlLocale(locale as Locale);

  const tHero = await getTranslations({ locale, namespace: "hero" });
  const tHome = await getTranslations({ locale, namespace: "home" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tActions = await getTranslations({ locale, namespace: "actions" });
  const tSearch = await getTranslations({ locale, namespace: "search" });
  const tCat = await getTranslations({ locale, namespace: "categories" });

  const stats = HOMEPAGE_STATS;
  const categories = HOMEPAGE_CATEGORIES;
  const series = HOMEPAGE_SERIES;
  const lessons = HOMEPAGE_LESSONS;

  return (
    <div className="flex flex-col gap-16 lg:gap-24 pb-16">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-stone-200/80 dark:border-stone-800/80 bg-gradient-to-b from-[#F5F1E8]/70 via-[var(--bg-parchment)] to-[var(--bg-parchment)] dark:from-[#08100C] dark:via-[var(--bg-parchment)] dark:to-[var(--bg-parchment)] pt-12 pb-16 lg:pt-20 lg:pb-24">
        {/* Subtle dot-grid ornamentation */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#1B4332 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">

            {/* Telegram archive badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-300 mb-6">
              <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{tHero("telegramNotice")}</span>
            </div>

            {/* Arabic grand headline — always shown in Arabic script as the library's identity */}
            <h1 className="font-bold text-3xl sm:text-5xl lg:text-6xl text-emerald-950 dark:text-emerald-100 tracking-tight leading-tight mb-3">
              مكتبة الشيخ محمد زين
            </h1>

            {/* Localised sub-headline */}
            <h2 className="font-serif font-bold text-xl sm:text-2xl text-stone-800 dark:text-stone-200 tracking-normal mb-4">
              {tHero("tagline")}
            </h2>

            {/* Description */}
            <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 leading-relaxed max-w-2xl mb-8">
              {tHero("description")}
            </p>

            {/* Hero search — navigates to /search, no client JS needed for basic submit */}
            <form
              action={`/${locale}/search`}
              method="GET"
              className="w-full max-w-xl relative flex items-center mb-8 shadow-sm"
            >
              <Search
                className="w-5 h-5 absolute start-4 text-stone-400 dark:text-stone-500 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                name="q"
                placeholder={tSearch("placeholder")}
                className="w-full ps-12 pe-28 py-3.5 bg-white dark:bg-[#121E18] border border-stone-300 dark:border-stone-700 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-500 transition-all"
                aria-label={tSearch("placeholder")}
              />
              <button
                type="submit"
                className="absolute end-2 px-4 py-2 bg-emerald-900 dark:bg-emerald-700 hover:bg-emerald-800 dark:hover:bg-emerald-600 text-amber-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {tSearch("searchButton")}
              </button>
            </form>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-medium">
              <Link
                href="/duruus"
                className="px-5 py-2.5 rounded-lg bg-emerald-900 dark:bg-emerald-700 text-amber-100 hover:bg-emerald-800 dark:hover:bg-emerald-600 shadow-sm transition-colors flex items-center gap-2"
              >
                <Headphones className="w-4 h-4" aria-hidden="true" />
                <span>{tHero("exploreDuruus")}</span>
              </Link>
              <Link
                href="/series"
                className="px-5 py-2.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-2"
              >
                <Layers className="w-4 h-4" aria-hidden="true" />
                <span>{tHero("browseSeries")}</span>
              </Link>
              <Link
                href="/kutub"
                className="px-5 py-2.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>{tHero("viewBooks")}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────── */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full -mt-8 sm:-mt-12"
        aria-label="Archive statistics"
      >
        <div className="bg-[var(--bg-surface)] dark:bg-[#111C16] border border-stone-200/90 dark:border-stone-800/90 rounded-xl p-6 sm:p-8 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-stone-200 dark:divide-stone-800 [&>[dir='rtl']_*]:divide-x-reverse">
            {[
              { value: stats.totalLessons, label: tHome("statsLessons") },
              { value: stats.totalSeries, label: tHome("statsSeries") },
              { value: stats.totalBooks, label: tHome("statsBooks") },
              { value: `${stats.totalAudioHours}h`, label: tHome("statsHours") },
              { value: stats.totalCategories, label: tHome("statsCategories") },
            ].map(({ value, label }, i) => (
              <div
                key={i}
                className={`pt-3 md:pt-0 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}
              >
                <span className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 block">
                  {value}
                  {typeof value === "number" && value > 0 ? "+" : ""}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400 mt-1 block">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories / Disciplines ─────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <SectionHeader
          eyebrow={tHero("categoriesSection")}
          title={tNav("categories")}
          viewAllHref="/categories"
          viewAllLabel={tActions("viewAll")}
          isRtl={isRtl}
        />

        {categories.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {tHome("noCategories")}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group flex flex-col gap-2 p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                    {cat.name}
                  </span>
                </div>
                {cat.description && (
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2">
                    {cat.description}
                  </p>
                )}
                {cat.lessonCount !== undefined && cat.lessonCount > 0 && (
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 mt-auto">
                    {cat.lessonCount} {tCat("lessonsCount")}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Featured Series ──────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <SectionHeader
          eyebrow={tHero("featuredSeries")}
          title={tNav("series")}
          viewAllHref="/series"
          viewAllLabel={tActions("viewAll")}
          isRtl={isRtl}
        />

        {series.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {tHome("noSeries")}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {series.map((s) => (
              <Link
                key={s.id}
                href={`/series/${s.slug}`}
                className="group flex flex-col gap-3 p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-[var(--bg-surface)] hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all"
              >
                {/* Colour band standing in for cover image until Media is wired */}
                <div className="w-full h-2 rounded-full bg-emerald-800/20 dark:bg-emerald-400/20" aria-hidden="true" />

                <div className="flex flex-col gap-1.5 flex-1">
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    {s.categoryName}
                  </span>
                  <h3 className="text-sm font-serif font-semibold text-stone-900 dark:text-stone-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors leading-snug">
                    {s.title}
                  </h3>
                  {s.description && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2">
                      {s.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500 pt-1 border-t border-stone-100 dark:border-stone-800">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" aria-hidden="true" />
                    {s.lessonCount ?? 0} {tCat("duruusCount")}
                  </span>
                  {s.totalDuration ? (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {Math.round((s.totalDuration ?? 0) / 3600)}h
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Recent Lessons ───────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <SectionHeader
          eyebrow={tHero("recentLessons")}
          title={tNav("lessons")}
          viewAllHref="/duruus"
          viewAllLabel={tActions("viewAll")}
          isRtl={isRtl}
        />

        {lessons.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {tHome("noLessons")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/duruus/${lesson.slug}`}
                className="group flex flex-col gap-3 p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-[var(--bg-surface)] hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                      <Headphones className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    </span>
                    <span className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 truncate">
                      {lesson.seriesTitle ?? lesson.categoryName}
                    </span>
                  </div>
                  {lesson.lessonNumber && (
                    <span className="shrink-0 text-[10px] font-mono text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                      #{lesson.lessonNumber}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 transition-colors leading-snug line-clamp-2">
                  {lesson.title}
                </h3>

                {lesson.description && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2">
                    {lesson.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[10px] text-stone-400 dark:text-stone-500 mt-auto pt-2 border-t border-stone-100 dark:border-stone-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {formatDuration(lesson.duration)}
                  </span>
                  {lesson.publishedAt && (
                    <span>{formatDate(lesson.publishedAt, locale)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Mission / Telegram banner ────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="relative rounded-2xl overflow-hidden border border-emerald-900/30 bg-[#0C1A14] text-stone-200 p-8 sm:p-12 lg:p-16">
          {/* Subtle dot pattern — decorative */}
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#34D399 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/60 text-xs font-medium text-amber-200 mb-4">
              <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{tHome("missionBadge")}</span>
            </div>

            <h3 className="font-serif font-bold text-2xl sm:text-4xl text-amber-100 mb-4 leading-tight">
              {tHome("missionTitle")}
            </h3>

            <p className="text-sm text-stone-300 leading-relaxed mb-8">
              {tHome("missionBody")}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
              <a
                href="https://t.me/ShaykhMuhammadZain_Archive"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-2 shadow-sm transition-colors"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>{tHome("joinTelegram")}</span>
              </a>
              <Link
                href="/about"
                className="px-5 py-3 rounded-lg bg-stone-800/80 hover:bg-stone-800 text-stone-200 border border-stone-700 flex items-center gap-2 transition-colors"
              >
                <Compass className="w-4 h-4" aria-hidden="true" />
                <span>{tHome("learnMore")}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

// ─── Internal helpers ─────────────────────────────────────

/**
 * Reusable section header with eyebrow text, title, and "View All" link.
 * Extracted to avoid repetition — not exported (homepage-only).
 */
function SectionHeader({
  eyebrow,
  title,
  viewAllHref,
  viewAllLabel,
  isRtl,
}: {
  eyebrow: string;
  title: string;
  viewAllHref: string;
  viewAllLabel: string;
  isRtl: boolean;
}) {
  return (
    <div className="flex items-end justify-between mb-8 border-b border-stone-200/80 dark:border-stone-800/80 pb-4">
      <div>
        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
          {eyebrow}
        </span>
        <h2 className="font-serif font-bold text-2xl sm:text-3xl text-stone-900 dark:text-stone-100 mt-1">
          {title}
        </h2>
      </div>
      <Link
        href={viewAllHref as Parameters<typeof Link>[0]["href"]}
        className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-emerald-300 flex items-center gap-1 group shrink-0"
      >
        <span>{viewAllLabel}</span>
        <ArrowRight
          className={`w-3.5 h-3.5 transition-transform ${
            isRtl
              ? "rotate-180 group-hover:-translate-x-0.5"
              : "group-hover:translate-x-0.5"
          }`}
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}

/** Format seconds as h:mm or mm:ss */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format ISO date string with locale-aware short date */
function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "am" ? "am-ET" : locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
