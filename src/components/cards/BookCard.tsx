import React from "react";
import { Link } from "@/i18n/navigation";
import { BookOpen, FileText } from "lucide-react";
import type { PublicBook } from "@/types/library";

interface BookCardProps {
  book: PublicBook;
  /** Pre-resolved label for "duruus" */
  duruusLabel: string;
  /** Pre-resolved "PDF Available" label */
  pdfLabel?: string;
}

/**
 * Book card — pure presentational Server Component.
 * Accepts pre-resolved strings; no LanguageContext or i18n hooks.
 */
export function BookCard({ book, duruusLabel, pdfLabel }: BookCardProps) {
  return (
    <Link
      href={`/kutub/${book.slug}`}
      className="group flex flex-col bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] border border-stone-200/80 dark:border-stone-800/80 rounded-xl overflow-hidden hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-sm transition-all"
    >
      {/* Cover placeholder */}
      <div className="relative aspect-[4/3] w-full bg-amber-900/10 dark:bg-amber-400/10 flex items-center justify-center overflow-hidden">
        <BookOpen
          className="w-10 h-10 text-amber-800/30 dark:text-amber-400/30 group-hover:scale-105 transition-transform duration-300"
          aria-hidden="true"
        />
        {/* Overlay: category + page count */}
        <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-[11px] font-medium">
          {book.categoryName && (
            <span className="bg-white/80 dark:bg-stone-900/80 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded">
              {book.categoryName}
            </span>
          )}
          {book.pdfPages && (
            <span className="flex items-center gap-1 bg-white/80 dark:bg-stone-900/80 text-stone-600 dark:text-stone-400 px-2 py-0.5 rounded">
              <FileText className="w-3 h-3" aria-hidden="true" />
              {book.pdfPages}p
            </span>
          )}
        </div>
        {/* PDF available badge */}
        {book.pdfAvailable && pdfLabel && (
          <div className="absolute top-2.5 start-2.5">
            <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
              {pdfLabel}
            </span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-5 flex flex-col justify-between flex-1">
        <div>
          <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors line-clamp-2 leading-snug mb-1.5">
            {book.title}
          </h3>

          {book.author && (
            <p className="text-xs text-stone-500 dark:text-stone-400 italic line-clamp-1 mb-2">
              {book.author}
            </p>
          )}

          {book.description && (
            <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed mb-4">
              {book.description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>
            {book.lessonCount ?? 0} {duruusLabel}
          </span>
          <span className="text-emerald-800 dark:text-emerald-400 font-medium group-hover:underline">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
