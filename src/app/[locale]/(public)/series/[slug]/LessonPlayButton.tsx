"use client";

import { Play, Pause } from "lucide-react";
import { useAudio } from "@/lib/context/AudioContext";
import type { PublicLesson } from "@/types/library";

export function LessonPlayButton({
  lesson,
  listenLabel,
}: {
  lesson: PublicLesson;
  listenLabel: string;
}) {
  const { currentLesson, isPlaying, playLesson, togglePlay } = useAudio();
  const isActive = currentLesson?.id === lesson.id;
  const isCurrentlyPlaying = isActive && isPlaying;

  return (
    <button
      onClick={() => (isActive ? togglePlay() : playLesson(lesson))}
      className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
        isCurrentlyPlaying
          ? "bg-amber-600 text-white"
          : "bg-emerald-900 hover:bg-emerald-800 text-amber-100"
      }`}
    >
      {isCurrentlyPlaying ? (
        <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
      ) : (
        <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{listenLabel}</span>
    </button>
  );
}
