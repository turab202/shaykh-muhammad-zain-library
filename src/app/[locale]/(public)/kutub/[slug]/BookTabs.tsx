"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAudio } from "@/lib/context/AudioContext";
import { Headphones, Clock, Play, BookOpen, ExternalLink, Download, Maximize2, ChevronUp } from "lucide-react";
import type { PublicLesson } from "@/types/library";

interface Props {
  lessons: PublicLesson[];
  pdfUrl?: string;
  pdfTitle?: string;
  pdfSize?: string;
  listenLabel: string;
  lessonsEmptyLabel: string;
  audiosTabLabel: string;
  kitabsTabLabel: string;
}

export function BookTabs({
  lessons,
  pdfUrl,
  pdfTitle,
  pdfSize,
  listenLabel,
  lessonsEmptyLabel,
  audiosTabLabel,
  kitabsTabLabel,
}: Props) {
  // Default to Kitabs tab if there's a PDF, otherwise Audios
  const [tab, setTab] = useState<"audios" | "kitabs">(pdfUrl ? "kitabs" : "audios");
  const [pdfExpanded, setPdfExpanded] = useState(false);
  const { playLesson } = useAudio();

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 mb-6">
        <button
          onClick={() => setTab("audios")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            tab === "audios"
              ? "border-emerald-800 text-emerald-800 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <Headphones className="w-4 h-4" aria-hidden="true" />
            {audiosTabLabel}
            {lessons.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-mono">
                {lessons.length}
              </span>
            )}
          </span>
        </button>

        {pdfUrl && (
          <button
            onClick={() => setTab("kitabs")}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === "kitabs"
                ? "border-amber-700 text-amber-800 dark:border-amber-400 dark:text-amber-400"
                : "border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              {kitabsTabLabel}
              <span className="px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-mono">
                1
              </span>
            </span>
          </button>
        )}
      </div>

      {/* ── Audios tab ──────────────────────────────────────────── */}
      {tab === "audios" && (
        lessons.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
            <Headphones className="w-10 h-10 mx-auto text-stone-300 mb-3" aria-hidden="true" />
            <p className="text-sm text-stone-500 dark:text-stone-400">{lessonsEmptyLabel}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {lessons.map((lesson) => {
              const isTg = (lesson.audioUrl ?? "").startsWith("/api/audio/");
              return (
                <div
                  key={lesson.id}
                  className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-stone-300 dark:hover:border-stone-700 transition-colors"
                >
                  {/* Headphones icon */}
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                    <Headphones className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  </div>

                  {/* Title + duration */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/duruus/${lesson.slug}`}
                      className="text-sm font-medium text-stone-900 dark:text-stone-100 hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors line-clamp-1"
                    >
                      {lesson.lessonNumber ? `${lesson.displayTitle}` : lesson.displayTitle}
                    </Link>
                    {lesson.description && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 line-clamp-1 mt-0.5" dir="rtl">
                        {lesson.description}
                      </p>
                    )}
                    {(lesson.duration ?? 0) > 0 && (
                      <p className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {fmt(lesson.duration)}
                      </p>
                    )}
                  </div>

                  {/* Play button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isTg) {
                        const msgId = lesson.audioUrl.split("/").pop();
                        window.open(`https://t.me/SheikhMuhammedZain/${msgId}`, "_blank", "noopener");
                      } else {
                        playLesson(lesson);
                      }
                    }}
                    className="shrink-0 w-9 h-9 rounded-full bg-emerald-900 dark:bg-emerald-800 text-amber-100 flex items-center justify-center hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm"
                    aria-label={`${listenLabel}: ${lesson.title}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current ms-0.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Kitabs tab ───────────────────────────────────────────── */}
      {tab === "kitabs" && pdfUrl && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-amber-700 to-emerald-800" />
          <div className="p-5 sm:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-16 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shadow-sm">
                  <BookOpen className="w-6 h-6 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                    PDF Kitab
                  </p>
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 line-clamp-2">
                    {pdfTitle}
                  </p>
                  {pdfSize && (
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{pdfSize}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Open
                </a>
                <a
                  href={pdfUrl}
                  download
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 dark:bg-amber-800 text-white text-xs font-medium hover:bg-amber-600 dark:hover:bg-amber-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Download
                </a>
                <button
                  onClick={() => setPdfExpanded((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-700 dark:border-emerald-700 text-emerald-800 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                >
                  {pdfExpanded
                    ? <><ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />Collapse</>
                    : <><Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />Read</>
                  }
                </button>
              </div>
            </div>

            {/* Inline iframe viewer */}
            {pdfExpanded && (
              <div className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800">
                <iframe
                  src={`${pdfUrl}#toolbar=1`}
                  title={pdfTitle}
                  className="w-full"
                  style={{ height: "80vh", minHeight: "500px" }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(s: number): string {
  if (!s) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Keep old export name for compatibility
export { BookTabs as BookLessons };
