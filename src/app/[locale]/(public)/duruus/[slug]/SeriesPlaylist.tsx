"use client";

import { Play } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAudio } from "@/lib/context/AudioContext";
import type { PublicLesson, PublicSeries } from "@/types/library";

interface SeriesPlaylistProps {
  series: PublicSeries;
  lessons: PublicLesson[];
  activeLessonId: string;
  viewAllLabel: string;
  otherLessonsLabel: string;
  sequentialLabel: string;
  listenLabel: string;
}

/**
 * Series playlist sidebar — client island.
 * Needs useAudio to enable per-lesson play buttons.
 */
export function SeriesPlaylist({
  series,
  lessons,
  activeLessonId,
  viewAllLabel,
  otherLessonsLabel,
  sequentialLabel,
  listenLabel,
}: SeriesPlaylistProps) {
  const { playLesson } = useAudio();

  return (
    <div className="bg-[var(--bg-surface-elevated)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100">
            {otherLessonsLabel}
          </h4>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {lessons.length} {sequentialLabel}
          </p>
        </div>
        <Link
          href={`/series/${series.slug}`}
          className="text-xs text-emerald-800 dark:text-emerald-400 hover:underline"
        >
          {viewAllLabel}
        </Link>
      </div>

      <div className="space-y-1.5 max-h-96 overflow-y-auto pe-1">
        {lessons.map((lesson) => {
          const isActive = lesson.id === activeLessonId;
          return (
            <div
              key={lesson.id}
              className={`p-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                isActive
                  ? "bg-emerald-900 text-amber-100 font-semibold shadow-sm"
                  : "hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
              }`}
            >
              <Link
                href={`/duruus/${lesson.slug}`}
                className="min-w-0 flex-1 flex items-center gap-2"
              >
                <span className="font-mono text-[11px] opacity-80 shrink-0">
                  #{String(lesson.lessonNumber ?? 0).padStart(2, "0")}
                </span>
                <span className="truncate">{lesson.title}</span>
              </Link>

              <div className="flex items-center gap-1 shrink-0">
                <span className="font-mono text-[10px] opacity-70">
                  {formatDuration(lesson.duration)}
                </span>
                {!isActive && (
                  <button
                    onClick={() => playLesson(lesson)}
                    aria-label={`${listenLabel}: ${lesson.title}`}
                    className="p-1 hover:text-emerald-800 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
