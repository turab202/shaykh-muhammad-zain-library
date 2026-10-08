import React from "react";
import { Link } from "@/i18n/navigation";
import { BookOpen, Headphones } from "lucide-react";
import type { PublicBook } from "@/types/library";

interface BookCardProps {
  book: PublicBook;
  duruusLabel: string;
  pdfLabel?: string;
}

export function BookCard({ book, duruusLabel, pdfLabel }: BookCardProps) {
  return (
    <Link
      href={`/kutub/${book.slug}`}
      className="group flex flex-col bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 rounded-xl overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all"
    >
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-emerald-800/40 to-amber-700/40 group-hover:from-emerald-800 group-hover:to-amber-700 transition-all" />

      {/* Cover area */}
      <div className="relative h-32 w-full bg-gradient-to-br from-emerald-900/8 to-amber-900/8 dark:from-emerald-400/8 dark:to-amber-400/8 flex items-center justify-center border-b border-stone-100 dark:border-stone-800">
        <BookOpen
          className="w-12 h-12 text-emerald-800/25 dark:text-emerald-400/25 group-hover:text-emerald-800/40 dark:group-hover:text-emerald-400/40 group-hover:scale-105 transition-all duration-300"
          aria-hidden="true"
        />
        {/* Category badge */}
        {book.categoryName && (
          <div className="absolute bottom-2 start-3">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 bg-white/80 dark:bg-stone-900/80 px-2 py-0.5 rounded uppercase tracking-wide">
              {book.categoryName}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-serif font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors line-clamp-2 leading-snug mb-1">
          {book.title}
        </h3>

        {book.author && (
          <p className="text-[11px] text-stone-400 dark:text-stone-500 italic line-clamp-1 mb-2">
            {book.author}
          </p>
        )}

        {book.description && (
          <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed mb-3 flex-1">
            {book.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800/60 mt-auto">
          <span className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
            <Headphones className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <strong className="text-stone-700 dark:text-stone-300">{book.lessonCount ?? 0}</strong>
            {" "}{duruusLabel}
          </span>
          <div className="flex items-center gap-2">
            {book.pdfAvailable && pdfLabel && (
              <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                PDF
              </span>
            )}
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
