"use client";

import { Link } from "@/i18n/navigation";
import { useAudio } from "@/lib/context/AudioContext";
import { Headphones, Clock } from "lucide-react";
import type { PublicLesson } from "@/types/library";

interface Props {
  lessons: PublicLesson[];
  listenLabel: string;
  lessonsEmptyLabel: string;
}

export function BookLessons({ lessons, listenLabel, lessonsEmptyLabel }: Props) {
  const { playLesson } = useAudio();

  if (lessons.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
        <Headphones className="w-10 h-10 mx-auto text-stone-300 mb-3" aria-hidden="true" />
        <p className="text-sm text-stone-500 dark:text-stone-400">{lessonsEmptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lessons.map((lesson) => (
        <div
          key={lesson.id}
          className="flex items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-stone-300 dark:hover:border-stone-700 transition-colors"
        >
          {/* Number + title */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-[11px] font-mono font-bold text-emerald-800 dark:text-emerald-400">
              {String(lesson.lessonNumber ?? 0).padStart(3, "0")}
            </span>
            <div className="min-w-0">
              <Link
                href={`/duruus/${lesson.slug}`}
                className="text-sm font-medium text-stone-900 dark:text-stone-100 hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors line-clamp-1"
              >
                {lesson.title}
              </Link>
              {lesson.duration > 0 && (
                <p className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {fmt(lesson.duration)}
                </p>
              )}
            </div>
          </div>

          {/* Play button */}
          <button
            type="button"
            onClick={() => playLesson(lesson)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900 dark:bg-emerald-800 text-amber-100 rounded-lg text-xs font-semibold hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-colors cursor-pointer"
            aria-label={`${listenLabel}: ${lesson.title}`}
          >
            <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
            {listenLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
