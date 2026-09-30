"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAudio } from "@/lib/context/AudioContext";
import { Headphones } from "lucide-react";
import { PDFViewerPlaceholder } from "@/components/common/PDFViewerPlaceholder";
import type { PublicBook, PublicLesson } from "@/types/library";

interface BookTabsProps {
  book: PublicBook;
  lessons: PublicLesson[];
  tabReaderLabel: string;
  tabContentsLabel: string;
  tabAudioLabel: string;
  chapterLabel: string;
  tocEmptyLabel: string;
  lessonsEmptyLabel: string;
  keyChaptersLabel: string;
  listenLabel: string;
  duruusLabel: string;
}

export function BookTabs({
  book, lessons,
  tabReaderLabel, tabContentsLabel, tabAudioLabel,
  tocEmptyLabel, lessonsEmptyLabel, listenLabel,
}: BookTabsProps) {
  const [tab, setTab] = useState<"reader" | "toc" | "lessons">("reader");
  const { playLesson } = useAudio();

  const tabs = [
    { key: "reader" as const, label: tabReaderLabel },
    { key: "toc" as const, label: tabContentsLabel },
    { key: "lessons" as const, label: tabAudioLabel },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="border-b border-stone-200 dark:border-stone-800 mb-6 flex items-center gap-6 text-sm font-medium overflow-x-auto">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-3 relative whitespace-nowrap transition-colors cursor-pointer ${
              tab === key
                ? "text-emerald-900 dark:text-emerald-300 font-semibold"
                : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            }`}
          >
            {label}
            {tab === key && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-800 dark:bg-emerald-400 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Tab: PDF Reader */}
      {tab === "reader" && (
        <PDFViewerPlaceholder
          title={book.title}
          pdfUrl={book.pdfUrl}
          totalPages={book.pdfPages ?? 1}
        />
      )}

      {/* Tab: Table of Contents */}
      {tab === "toc" && (
        <div className="bg-[var(--bg-surface)] dark:bg-[#111C16] border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-sm">
          {book.tableOfContents && book.tableOfContents.length > 0 ? (
            <div className="divide-y divide-stone-200/80 dark:divide-stone-800/80">
              {book.tableOfContents.map((item) => {
                const lesson = item.lessonId ? lessons.find((l) => l.id === item.lessonId) : undefined;
                return (
                  <div key={item.chapter} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-stone-400 w-8">{String(item.chapter).padStart(2, "0")}</span>
                      <p className="font-semibold text-stone-800 dark:text-stone-200">{item.title}</p>
                    </div>
                    {lesson && (
                      <button onClick={() => playLesson(lesson)} className="px-3 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded font-medium transition-colors flex items-center gap-1.5 cursor-pointer">
                        <Headphones className="w-3.5 h-3.5" aria-hidden="true" />{listenLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-stone-500 dark:text-stone-400 text-center py-6">{tocEmptyLabel}</p>
          )}
        </div>
      )}

      {/* Tab: Audio Lessons */}
      {tab === "lessons" && (
        <div className="flex flex-col gap-3">
          {lessons.length > 0 ? lessons.map((lesson) => (
            <div key={lesson.id} className="p-4 bg-[var(--bg-surface)] dark:bg-[#111C16] border border-stone-200 dark:border-stone-800 rounded-lg flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] text-stone-500 mb-0.5">
                  <span className="font-mono font-medium">#{String(lesson.lessonNumber ?? 0).padStart(3, "0")}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fmt(lesson.duration)}</span>
                </div>
                <Link href={`/duruus/${lesson.slug}`} className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100 hover:text-emerald-800 dark:hover:text-emerald-400">{lesson.title}</Link>
              </div>
              <button onClick={() => playLesson(lesson)} className="px-3 py-1.5 bg-emerald-900 text-amber-100 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-emerald-800 transition-colors">
                <Headphones className="w-3.5 h-3.5" aria-hidden="true" />{listenLabel}
              </button>
            </div>
          )) : (
            <div className="py-12 text-center text-xs text-stone-500 dark:text-stone-400">{lessonsEmptyLabel}</div>
          )}
        </div>
      )}
    </>
  );
}

function fmt(s: number): string { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; }
