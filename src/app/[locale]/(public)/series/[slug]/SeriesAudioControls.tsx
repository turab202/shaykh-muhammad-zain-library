"use client";

import { Play, Pause } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAudio } from "@/lib/context/AudioContext";
import type { PublicLesson } from "@/types/library";
import { FileText } from "lucide-react";

interface SeriesAudioControlsProps {
  /** All lessons in the series (for "Start from #1" button) */
  lessons: PublicLesson[];
  startLabel: string;
  bookId?: string;
  bookSlug?: string;
  bookLabel?: string;
}

/**
 * Client island — hero audio controls for the series detail page.
 * Provides "Start from Lesson 1" button + optional "View Book" link.
 */
export function SeriesAudioControls({
  lessons,
  startLabel,
  bookId,
  bookSlug,
  bookLabel,
}: SeriesAudioControlsProps) {
  const { playLesson } = useAudio();
  const firstLesson = lessons[0];

  return (
    <div className="flex flex-wrap items-center gap-3 mt-4">
      {firstLesson && (
        <button
          onClick={() => playLesson(firstLesson)}
          className="px-5 py-2.5 rounded-lg bg-emerald-900 dark:bg-emerald-700 text-amber-100 hover:bg-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" aria-hidden="true" />
          {startLabel}
        </button>
      )}

      {bookSlug && bookLabel && (
        <Link
          href={`/kutub/${bookSlug}`}
          className="px-4 py-2.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 text-xs font-semibold flex items-center gap-2 transition-colors"
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          {bookLabel}
        </Link>
      )}
    </div>
  );
}
