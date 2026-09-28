"use client";

/**
 * SearchResults — client island for the search page.
 *
 * TEMPORARY STUB: All queries currently return empty results.
 * To wire real search:
 *   1. Create src/app/api/search/route.ts
 *   2. Replace the `results` constant below with:
 *      const results = await fetch(`/api/search?q=${encodeURIComponent(query)}&locale=${locale}`)
 *        .then(r => r.json())
 *   This stub is clearly separated so Stage H can drop in the real implementation.
 */

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Search, Compass, X } from "lucide-react";
import { LessonCard } from "@/components/cards/LessonCard";
import { SeriesCard } from "@/components/cards/SeriesCard";
import { BookCard } from "@/components/cards/BookCard";
import { CategoryCard } from "@/components/cards/CategoryCard";
import type { PublicLesson, PublicSeries, PublicBook, PublicCategory } from "@/types/library";

interface SearchResultsLabels {
  title: string;
  placeholder: string;
  searchButton: string;
  allResults: string;
  tabLessons: string;
  tabSeries: string;
  tabBooks: string;
  tabDisciplines: string;
  foundMatches: string;
  noResults: string;
  noMatchHint: string;
  emptyPrompt: string;
  duruusLabel: string;
}

interface ResultSet {
  lessons: PublicLesson[];
  series: PublicSeries[];
  books: PublicBook[];
  categories: PublicCategory[];
  totalCount: number;
}

const EMPTY_RESULTS: ResultSet = {
  lessons: [],
  series: [],
  books: [],
  categories: [],
  totalCount: 0,
};

function SearchContent({ labels }: { labels: SearchResultsLabels }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  const queryParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<
    "all" | "lessons" | "series" | "books" | "categories"
  >("all");

  // Sync query state when URL param changes (e.g. browser back/forward)
  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  // TEMPORARY: stub — replace with real API call in Stage H
  const results: ResultSet = EMPTY_RESULTS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/${locale}/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const tabs = [
    { key: "all" as const, label: `${labels.allResults} (${results.totalCount})` },
    { key: "lessons" as const, label: `${labels.tabLessons} (${results.lessons.length})` },
    { key: "series" as const, label: `${labels.tabSeries} (${results.series.length})` },
    { key: "books" as const, label: `${labels.tabBooks} (${results.books.length})` },
    { key: "categories" as const, label: `${labels.tabDisciplines} (${results.categories.length})` },
  ];

  return (
    <>
      {/* Search bar */}
      <div className="max-w-2xl mx-auto text-center mb-8">
        <h1 className="font-serif font-bold text-3xl text-stone-900 dark:text-stone-100 mb-4">
          {labels.title}
        </h1>
        <form onSubmit={handleSubmit} className="relative flex items-center shadow-sm">
          <Search
            className="w-5 h-5 absolute start-3.5 text-stone-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            className="w-full ps-11 pe-24 py-3 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-800"
          />
          <button
            type="submit"
            className="absolute end-2 px-3.5 py-1.5 bg-emerald-900 text-amber-100 rounded-lg text-xs font-semibold hover:bg-emerald-800 cursor-pointer transition-colors"
          >
            {labels.searchButton}
          </button>
        </form>
      </div>

      {/* Results */}
      {queryParam.trim() ? (
        <div>
          {/* Tabs */}
          <div className="border-b border-stone-200 dark:border-stone-800 mb-8 flex items-center justify-between overflow-x-auto">
            <div className="flex items-center gap-6 text-xs sm:text-sm font-medium whitespace-nowrap">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`pb-3 relative transition-colors cursor-pointer ${
                    activeTab === key
                      ? "text-emerald-900 dark:text-emerald-300 font-semibold"
                      : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                  }`}
                >
                  {label}
                  {activeTab === key && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-800 dark:bg-emerald-400 rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <span className="text-xs text-stone-400 hidden sm:inline ps-4 shrink-0">
              {results.totalCount} {labels.foundMatches} &ldquo;{queryParam}&rdquo;
            </span>
          </div>

          {/* Empty state — shown until real search is wired in Stage H */}
          <div className="py-20 text-center border border-dashed border-stone-300 dark:border-stone-800 rounded-xl">
            <Compass
              className="w-10 h-10 mx-auto text-stone-400 mb-3 opacity-60"
              aria-hidden="true"
            />
            <h3 className="font-serif font-bold text-base text-stone-800 dark:text-stone-200">
              {labels.noResults}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
              {labels.noMatchHint}
            </p>
            {/* Stage H note — do not remove until real search is implemented */}
            <p className="text-[10px] text-stone-400 mt-4 italic">
              Full-text search will be available in Stage H (PostgreSQL FTS).
            </p>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-stone-400 dark:text-stone-500">
          <Compass className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
          <p className="text-sm font-medium">{labels.emptyPrompt}</p>
        </div>
      )}
    </>
  );
}

export function SearchResults({ labels }: { labels: SearchResultsLabels }) {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        </div>
      }
    >
      <SearchContent labels={labels} />
    </Suspense>
  );
}
