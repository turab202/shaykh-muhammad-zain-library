"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAudio } from "@/lib/context/AudioContext";
import { Play, Pause, FileText, Clock } from "lucide-react";
import type { PublicLesson } from "@/types/library";

interface LessonCardProps {
  lesson: PublicLesson;
  viewMode?: "card" | "row";
}

/**
 * LessonCard — client component (needs useAudio for play/pause).
 * Accepts pre-resolved strings via PublicLesson props.
 * LearningContext (bookmarks/completed) is deferred — not wired yet.
 */
export function LessonCard({ lesson, viewMode = "card" }: LessonCardProps) {
  const { currentLesson, isPlaying, playLesson, togglePlay } = useAudio();
  const t = useTranslations("actions");

  const isCurrent = currentLesson?.id === lesson.id;
  const isCurrentlyPlaying = isCurrent && isPlaying;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCurrent) togglePlay();
    else playLesson(lesson);
  };

  // ── Row view ──────────────────────────────────────────
  if (viewMode === "row") {
    return (
      <div
        className={`group flex items-center justify-between p-3.5 sm:p-4 rounded-lg border transition-all ${
          isCurrent
            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 shadow-sm"
            : "bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] border-stone-200/80 dark:border-stone-800/80 hover:border-stone-300 dark:hover:border-stone-700"
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Play button */}
          <button
            onClick={handlePlay}
            aria-label={isCurrentlyPlaying ? t("pause") : t("play")}
            className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isCurrentlyPlaying
                ? "bg-emerald-800 text-amber-100 shadow-sm"
                : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 group-hover:bg-emerald-900 group-hover:text-amber-100"
            }`}
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4 fill-current ms-0.5" aria-hidden="true" />
            )}
          </button>

          {/* Metadata */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 mb-0.5">
              <span className="font-mono font-medium">
                #{String(lesson.lessonNumber ?? 0).padStart(3, "0")}
              </span>
              {lesson.categoryName && (
                <>
                  <span aria-hidden="true">·</span>
                  <Link
                    href={`/categories/${lesson.categoryId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline text-emerald-800 dark:text-emerald-400 font-medium truncate"
                  >
                    {lesson.categoryName}
                  </Link>
                </>
              )}
              {lesson.seriesTitle && (
                <>
                  <span aria-hidden="true">·</span>
                  <Link
                    href={`/series/${lesson.seriesSlug ?? lesson.seriesId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline text-stone-600 dark:text-stone-400 truncate"
                  >
                    {lesson.seriesTitle}
                  </Link>
                </>
              )}
            </div>

            <Link
              href={`/duruus/${lesson.slug}`}
              className="text-sm font-semibold text-stone-900 dark:text-stone-100 group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors line-clamp-1"
            >
              {lesson.title}
            </Link>

            <div className="flex items-center gap-3 text-[11px] text-stone-400 dark:text-stone-500 mt-1">
              <span className="font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {formatDuration(lesson.duration)}
              </span>
              {lesson.publishedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{lesson.publishedAt}</span>
                </>
              )}
              {lesson.pdfUrl && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" aria-hidden="true" />
                    PDF
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Card view ─────────────────────────────────────────
  return (
    <div
      className={`group flex flex-col justify-between p-5 rounded-xl border transition-all ${
        isCurrent
          ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-sm"
          : "bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] border-stone-200/80 dark:border-stone-800/80 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-sm"
      }`}
    >
      <div>
        {/* Metadata line */}
        <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-3">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-mono font-medium text-emerald-800 dark:text-emerald-400">
              #{String(lesson.lessonNumber ?? 0).padStart(3, "0")}
            </span>
            {lesson.categoryName && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{lesson.categoryName}</span>
              </>
            )}
          </div>
        </div>

        {/* Title */}
        <Link
          href={`/duruus/${lesson.slug}`}
          className="block text-base font-serif font-bold text-stone-900 dark:text-stone-100 group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors line-clamp-2 leading-snug mb-2"
        >
          {lesson.title}
        </Link>

        {lesson.seriesTitle && (
          <Link
            href={`/series/${lesson.seriesSlug ?? lesson.seriesId}`}
            className="text-xs text-stone-500 dark:text-stone-400 hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors line-clamp-1 mb-3 block"
          >
            {lesson.seriesTitle}
          </Link>
        )}

        {lesson.description && (
          <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed mb-4">
            {lesson.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center justify-between text-xs">
        <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
          <Clock className="w-3 h-3" aria-hidden="true" />
          {formatDuration(lesson.duration)}
        </span>

        <button
          onClick={handlePlay}
          aria-label={isCurrentlyPlaying ? t("pause") : t("play")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            isCurrentlyPlaying
              ? "bg-emerald-800 text-amber-100"
              : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 group-hover:bg-emerald-900 group-hover:text-amber-100"
          }`}
        >
          {isCurrentlyPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>{t("playing")}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ms-0.5" aria-hidden="true" />
              <span>{t("play")}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
