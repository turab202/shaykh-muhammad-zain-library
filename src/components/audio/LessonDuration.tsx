"use client";

/**
 * Shows the lesson duration.
 * Uses real duration from AudioContext when this lesson is active
 * (i.e. the audio element has loaded and reported actual duration),
 * otherwise falls back to the DB value.
 */
import { useAudio } from "@/lib/context/AudioContext";
import { Clock } from "lucide-react";

interface LessonDurationProps {
  lessonId: string;
  dbDuration: number; // seconds, from DB (may be an estimate)
}

function fmt(s: number): string {
  if (!s || s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function LessonDuration({ lessonId, dbDuration }: LessonDurationProps) {
  const { currentLesson, duration: ctxDuration } = useAudio();

  // Use real duration from audio element when this lesson is the active one
  const isActive = currentLesson?.id === lessonId;
  const realDuration = isActive && ctxDuration > 0 ? ctxDuration : dbDuration;

  return (
    <span className="flex items-center gap-1">
      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
      {fmt(realDuration)}
    </span>
  );
}


