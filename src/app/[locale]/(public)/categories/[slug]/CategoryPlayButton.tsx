"use client";

import { Play } from "lucide-react";
import { useAudio } from "@/lib/context/AudioContext";
import type { PublicLesson } from "@/types/library";

/** Minimal client island — wraps a single Play button wired to AudioContext. */
export function CategoryPlayButton({ lesson }: { lesson: PublicLesson }) {
  const { playLesson } = useAudio();
  return (
    <button
      onClick={() => playLesson(lesson)}
      aria-label={`Play ${lesson.title}`}
      className="p-2 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-100 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
    >
      <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
    </button>
  );
}
