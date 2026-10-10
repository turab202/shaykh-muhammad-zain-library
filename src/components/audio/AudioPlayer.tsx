"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useAudio } from "@/lib/context/AudioContext";
import { Link } from "@/i18n/navigation";
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
  BookOpen,
} from "lucide-react";
import type { PublicLesson } from "@/types/library";

interface AudioPlayerProps {
  lesson: PublicLesson;
  /** If the lesson belongs to a book that has a PDF, pass the book slug here */
  bookSlug?: string;
  bookPdfUrl?: string;
}

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0] as const;

/**
 * Full-featured audio player for lesson detail pages.
 * Wires directly to AudioContext — no LearningContext dependency
 * (bookmarks/completed are deferred to a later phase).
 */
export function AudioPlayer({ lesson, bookSlug, bookPdfUrl }: AudioPlayerProps) {
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
  // Use real audio duration from context when active (loadedmetadata gives true value),
  // fall back to DB value when lesson hasn't been played yet this session.
  const activeDuration = isActive && duration > 0 ? duration : (lesson.duration ?? 0);
  const percent = activeDuration > 0 ? (activeTime / activeDuration) * 100 : 0;

  // Detect if audio is a Telegram proxy (not yet downloaded to storage)
  const isTelegramProxy = (lesson.audioUrl ?? "").startsWith("/api/audio/");
  const msgId = isTelegramProxy ? lesson.audioUrl.split("/").pop() : null;

  const handlePlayToggle = () => {
    if (!isActive) playLesson(lesson);
    else togglePlay();
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (!isActive) {
      playLesson(lesson);
      return;
    }
    seek(ratio * activeDuration);
    // If paused, resume after seeking
    if (!activeIsPlaying) {
      setTimeout(() => {
        if (!isActive) return;
        // togglePlay will call resume() which re-calls play()
      }, 0);
    }
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-[var(--bg-surface-elevated)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-xl p-4 sm:p-8 shadow-sm">

      {/* Telegram fallback banner — shown when audio not yet in storage */}
      {isTelegramProxy && (
        <div className="mb-5 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Audio available on Telegram</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              This lesson&apos;s audio file has not been downloaded to the server yet. Click to listen directly on Telegram.
            </p>
          </div>
          <a
            href={`https://t.me/SheikhMuhammedZain/${msgId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Open in Telegram →
          </a>
        </div>
      )}

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
          {/* Show real duration from audio context when active, DB value otherwise */}
          <span>{formatDurationHuman(activeDuration)}</span>
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
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">

        {/* Speed selector */}
        <div className="flex w-full items-center gap-1 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-lg border border-stone-200 dark:border-stone-700/60 sm:w-auto">
          {SPEEDS.map((rate) => (
            <button
              key={rate}
              onClick={() => setRate(rate)}
              className={`min-h-11 flex-1 px-1.5 py-2 text-center text-xs font-medium rounded-md transition-colors cursor-pointer sm:min-h-0 sm:flex-none sm:px-2 sm:py-1 ${
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
        <div className="flex items-center justify-center gap-3 sm:gap-5">
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
        <div className="flex items-center justify-center gap-2">
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

          {/* Open PDF Kitab — follow along while listening */}
          {(bookPdfUrl || bookSlug) && (
            bookPdfUrl ? (
              <a
                href={bookPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open PDF to follow along"
                className="p-2 rounded-md border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors flex items-center gap-1 text-xs font-medium"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span className="hidden md:inline">Kitab</span>
              </a>
            ) : (
              <Link
                href={`/kutub/${bookSlug}`}
                title="Open the book"
                className="p-2 rounded-md border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors flex items-center gap-1 text-xs font-medium"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span className="hidden md:inline">Kitab</span>
              </Link>
            )
          )}
        </div>
      </div>

      {/* Keyboard shortcuts footer */}
      <div className="hidden sm:flex mt-6 pt-4 border-t border-stone-200/80 dark:border-stone-800/80 text-[11px] text-stone-400 dark:text-stone-500 items-center justify-between">
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
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}


