import React from "react";
import { Link } from "@/i18n/navigation";
import { BookOpen } from "lucide-react";
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
      {/* Cover image area */}
      <div className="relative h-44 w-full overflow-hidden border-b border-stone-100 dark:border-stone-800 bg-gradient-to-br from-emerald-900/10 to-amber-900/10 dark:from-emerald-400/8 dark:to-amber-400/8">
        {book.coverImageUrl ? (
          /* Real cover image */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverImageUrl}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          /* Placeholder — stylised book spine */
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4">
            <BookOpen
              className="w-14 h-14 text-emerald-800/20 dark:text-emerald-400/20 group-hover:text-emerald-800/35 dark:group-hover:text-emerald-400/35 group-hover:scale-105 transition-all duration-300"
              aria-hidden="true"
            />
            {/* Book title as pseudo spine text */}
            <p className="text-[11px] font-bold text-center text-stone-600/50 dark:text-stone-400/40 line-clamp-3 leading-tight font-serif px-2">
              {book.title}
            </p>
          </div>
        )}

        {/* PDF badge — top-right */}
        {book.pdfAvailable && pdfLabel && (
          <div className="absolute top-2 end-2">
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-900/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 backdrop-blur-sm">
              PDF
            </span>
          </div>
        )}

        {/* Category badge — bottom-left */}
        {book.categoryName && (
          <div className="absolute bottom-2 start-2">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-white/85 dark:bg-stone-900/85 px-2 py-0.5 rounded backdrop-blur-sm uppercase tracking-wide">
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
            <BookOpen className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span className="font-medium text-stone-700 dark:text-stone-300">
              {book.pdfAvailable ? "Available" : "Coming soon"}
            </span>
          </span>
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}


