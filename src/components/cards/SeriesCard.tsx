import React from "react";
import { Link } from "@/i18n/navigation";
import { Layers, Clock, BookOpen } from "lucide-react";
import type { PublicSeries } from "@/types/library";

interface SeriesCardProps {
  series: PublicSeries;
  /** Pre-resolved label for "duruus" (e.g. "duruus" / "دروس" / "ትምህርቶች") */
  duruusLabel: string;
}

/**
 * Series card — pure presentational Server Component.
 * Accepts pre-resolved strings; no LanguageContext or i18n hooks.
 */
export function SeriesCard({ series, duruusLabel }: SeriesCardProps) {
  const durationHours = series.totalDuration
    ? Math.round(series.totalDuration / 3600)
    : null;

  return (
    <Link
      href={`/series/${series.slug}`}
      className="group flex flex-col bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] border border-stone-200/80 dark:border-stone-800/80 rounded-xl overflow-hidden hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-sm transition-all"
    >
      {/* Cover placeholder — replaced by real image once Media is wired */}
      <div className="relative aspect-video w-full bg-emerald-900/10 dark:bg-emerald-400/10 flex items-center justify-center overflow-hidden">
        <Layers
          className="w-10 h-10 text-emerald-800/30 dark:text-emerald-400/30 group-hover:scale-105 transition-transform duration-300"
          aria-hidden="true"
        />
        {/* Overlay badges */}
        <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400 font-medium">
          {series.categoryName && (
            <span className="bg-white/80 dark:bg-stone-900/80 px-2 py-0.5 rounded">
              {series.categoryName}
            </span>
          )}
          {durationHours !== null && (
            <span className="flex items-center gap-1 bg-white/80 dark:bg-stone-900/80 px-2 py-0.5 rounded">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {durationHours}h
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-5 flex flex-col justify-between flex-1">
        <div>
          <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors line-clamp-2 leading-snug mb-2">
            {series.title}
          </h3>

          {series.description && (
            <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed mb-4">
              {series.description}
            </p>
          )}
        </div>

        {/* Footer stats */}
        <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-300">
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {series.lessonCount ?? 0} {duruusLabel}
            </span>
          </div>
          <span className="text-emerald-800 dark:text-emerald-400 font-medium group-hover:underline text-xs">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
