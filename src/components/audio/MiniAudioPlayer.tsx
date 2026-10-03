"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAudio } from "@/lib/context/AudioContext";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  Maximize2,
} from "lucide-react";

/**
 * Sticky bottom mini-player — rendered globally inside [locale]/layout.tsx.
 * Visible only when a lesson is playing (isMiniPlayerOpen = true).
 *
 * No LearningContext dependency (bookmarks/completed deferred).
 * No LibraryRepository — formatDuration inlined.
 */
export function MiniAudioPlayer() {
  const {
    currentLesson,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seek,
    skip,
    volume,
    setVol,
    isMuted,
    toggleMute,
    isMiniPlayerOpen,
    closeMiniPlayer,
  } = useAudio();

  const tActions = useTranslations("actions");
  const tLesson = useTranslations("lesson");
  const tCommon = useTranslations("common");

  if (!isMiniPlayerOpen || !currentLesson) return null;

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <aside
      aria-label="Audio player dock"
      className="fixed bottom-0 inset-x-0 z-50 bg-[var(--bg-parchment)] dark:bg-[var(--bg-parchment)] border-t border-stone-300 dark:border-stone-800 shadow-2xl"
    >
      {/* Interactive progress bar */}
      <div
        className="w-full h-1.5 bg-stone-200 dark:bg-stone-800 cursor-pointer relative group"
        role="slider"
        aria-label="Audio progress"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.floor(currentTime)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - rect.left) / rect.width) * duration);
        }}
      >
        <div
          className="h-full bg-emerald-800 dark:bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        >
          <div className="absolute end-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-500 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 sm:gap-6">

        {/* Left: Lesson metadata + play */}
        <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial">
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? tActions("pause") : tActions("play")}
            className="w-9 h-9 shrink-0 rounded-full bg-emerald-900 dark:bg-emerald-700 text-amber-100 flex items-center justify-center hover:bg-emerald-800 dark:hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4 fill-current ms-0.5" aria-hidden="true" />
            )}
          </button>

          <div className="flex flex-col min-w-0">
            <Link
              href={`/duruus/${currentLesson.slug}`}
              className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 truncate hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
            >
              {currentLesson.title}
            </Link>
            <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
              {currentLesson.seriesTitle && (
                <span className="truncate">{currentLesson.seriesTitle}</span>
              )}
              {currentLesson.seriesTitle && <span aria-hidden="true">·</span>}
              <span className="font-mono tabular-nums shrink-0">
                {fmt(Math.floor(currentTime))} / {fmt(Math.floor(duration))}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Skip buttons (desktop only) */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => skip(-10)}
            title={tLesson("rewind10")}
            aria-label={tLesson("rewind10")}
            className="p-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => skip(10)}
            title={tLesson("forward10")}
            aria-label={tLesson("forward10")}
            className="p-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Right: Volume, maximize, close */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Volume — hidden on small mobile */}
          <div className="hidden sm:flex items-center gap-1.5 text-stone-500">
            <button
              onClick={toggleMute}
              aria-label={tLesson("volume")}
              className="p-1 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-stone-400" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVol(parseFloat(e.target.value))}
              aria-label={tLesson("volume")}
              className="volume-slider w-16 cursor-pointer"
              style={{ "--volume-progress": `${(isMuted ? 0 : volume) * 100}%` } as CSSProperties}
            />
          </div>

          {/* Expand to lesson detail */}
          <Link
            href={`/duruus/${currentLesson.slug}`}
            title={tActions("listen")}
            aria-label={tActions("listen")}
            className="p-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors"
          >
            <Maximize2 className="w-4 h-4" aria-hidden="true" />
          </Link>

          {/* Close */}
          <button
            onClick={closeMiniPlayer}
            title={tCommon("close")}
            aria-label={tCommon("close")}
            className="p-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
