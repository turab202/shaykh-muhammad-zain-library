"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useAudio } from "@/lib/context/AudioContext";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  Share2,
  Check,
} from "lucide-react";
import type { PublicLesson } from "@/types/library";

interface AudioPlayerProps {
  lesson: PublicLesson;
}

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0] as const;

/**
 * Full-featured audio player for lesson detail pages.
 * Wires directly to AudioContext — no LearningContext dependency
 * (bookmarks/completed are deferred to a later phase).
 */
export function AudioPlayer({ lesson }: AudioPlayerProps) {
  const {
    currentLesson,
    isPlaying,
    currentTime,
    duration,
    playLesson,
    togglePlay,
    seek,
    skip,
    playbackRate,
    setRate,
    volume,
    setVol,
    isMuted,
    toggleMute,
  } = useAudio();

  const tActions = useTranslations("actions");
  const tLesson = useTranslations("lesson");
  const [copied, setCopied] = useState(false);

  const isActive = currentLesson?.id === lesson.id;
  const activeIsPlaying = isActive && isPlaying;
  const activeTime = isActive ? currentTime : 0;
  const activeDuration = isActive && duration > 0 ? duration : lesson.duration;
  const percent = activeDuration > 0 ? (activeTime / activeDuration) * 100 : 0;

  const handlePlayToggle = () => {
    if (!isActive) playLesson(lesson);
    else togglePlay();
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (!isActive) playLesson(lesson);
    seek(ratio * activeDuration);
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-[var(--bg-surface-elevated)] dark:bg-[#111C16] border border-stone-200 dark:border-stone-800 rounded-xl p-6 sm:p-8 shadow-sm">

      {/* Status bar */}
      <div className="flex items-center justify-between gap-4 mb-6 text-xs text-stone-500 dark:text-stone-400">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              activeIsPlaying
                ? "bg-emerald-600 dark:bg-emerald-400"
                : "bg-stone-400 dark:bg-stone-600"
            }`}
            aria-hidden="true"
          />
          <span className="font-medium text-stone-700 dark:text-stone-300">
            {activeIsPlaying ? tActions("playing") : tActions("audioLecture")}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDurationHuman(lesson.duration)}</span>
        </div>
      </div>

      {/* Scrubber */}
      <div className="mb-6">
        <div
          role="slider"
          aria-label="Audio progress"
          aria-valuemin={0}
          aria-valuemax={activeDuration}
          aria-valuenow={Math.floor(activeTime)}
          className="w-full h-2.5 bg-stone-200 dark:bg-stone-800 rounded-full cursor-pointer relative overflow-hidden"
          onClick={handleScrub}
        >
          <div
            className="h-full bg-emerald-800 dark:bg-emerald-500 rounded-full transition-all duration-75"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs font-mono text-stone-500 dark:text-stone-400 mt-2">
          <span>{formatDuration(Math.floor(activeTime))}</span>
          <span>{formatDuration(Math.floor(activeDuration))}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">

        {/* Speed selector */}
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-lg border border-stone-200 dark:border-stone-700/60">
          {SPEEDS.map((rate) => (
            <button
              key={rate}
              onClick={() => setRate(rate)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                playbackRate === rate
                  ? "bg-white dark:bg-stone-700 text-emerald-900 dark:text-emerald-300 font-semibold shadow-sm"
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
              }`}
            >
              {rate}×
            </button>
          ))}
        </div>

        {/* Primary transport */}
        <div className="flex items-center gap-3 sm:gap-5">
          <button
            onClick={() => isActive && skip(-10)}
            disabled={!isActive}
            title={tLesson("rewind10")}
            aria-label={tLesson("rewind10")}
            className="p-2.5 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            onClick={handlePlayToggle}
            aria-label={activeIsPlaying ? tActions("pause") : tActions("play")}
            className="w-14 h-14 rounded-full bg-emerald-900 dark:bg-emerald-600 text-amber-100 flex items-center justify-center hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-transform active:scale-95 shadow-md cursor-pointer"
          >
            {activeIsPlaying ? (
              <Pause className="w-6 h-6 fill-current" aria-hidden="true" />
            ) : (
              <Play className="w-6 h-6 fill-current ms-0.5" aria-hidden="true" />
            )}
          </button>

          <button
            onClick={() => isActive && skip(10)}
            disabled={!isActive}
            title={tLesson("forward10")}
            aria-label={tLesson("forward10")}
            className="p-2.5 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <RotateCw className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Volume + share + download */}
        <div className="flex items-center gap-2">
          {/* Volume (hidden on small screens) */}
          <div className="hidden sm:flex items-center gap-1.5 text-stone-500 me-2">
            <button
              onClick={toggleMute}
              aria-label={tLesson("volume")}
              className="p-1.5 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" aria-hidden="true" />
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
              className="volume-slider w-20 cursor-pointer"
              style={{ "--volume-progress": `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
            />
          </div>

          {/* Share */}
          <button
            onClick={handleShare}
            title={tActions("share")}
            aria-label={tActions("share")}
            className="p-2 rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer flex items-center gap-1 text-xs"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <Share2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span className="hidden md:inline">
              {copied ? tActions("shareCopied").split(" ")[0] : tActions("share")}
            </span>
          </button>

          {/* Download */}
          <a
            href={lesson.audioUrl}
            download={`Lesson_${lesson.lessonNumber ?? ""}.mp3`}
            title={tActions("downloadAudio")}
            aria-label={tActions("downloadAudio")}
            className="p-2 rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1 text-xs"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span className="hidden md:inline">{tActions("downloadAudio")}</span>
          </a>
        </div>
      </div>

      {/* Keyboard shortcuts footer */}
      <div className="mt-6 pt-4 border-t border-stone-200/80 dark:border-stone-800/80 text-[11px] text-stone-400 dark:text-stone-500 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>{tLesson("shortcuts")}:</span>
          <span>
            <kbd className="px-1 py-0.5 bg-stone-200/70 dark:bg-stone-800 rounded font-mono">
              Space
            </kbd>{" "}
            {tLesson("playPause")}
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-stone-200/70 dark:bg-stone-800 rounded font-mono">
              ← / →
            </kbd>{" "}
            {tLesson("seek10")}
          </span>
        </div>
        <span className="hidden sm:inline">{tLesson("backgroundAudio")}</span>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDurationHuman(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} mins`;
}
