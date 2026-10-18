"use client";

import { useState, useMemo } from "react";
import { Search, Layers, SlidersHorizontal } from "lucide-react";
import { SeriesCard } from "@/components/cards/SeriesCard";
import type { PublicSeries, PublicCategory } from "@/types/library";

interface SeriesFilterProps {
  series: PublicSeries[];
  categories: PublicCategory[];
  duruusLabel: string;
  allCategoriesLabel: string;
  searchPlaceholder: string;
  filterLabel: string;
  clearFiltersLabel: string;
  noResultsLabel: string;
}

export function SeriesFilter({
  series,
  categories,
  duruusLabel,
  allCategoriesLabel,
  searchPlaceholder,
  filterLabel,
  clearFiltersLabel,
  noResultsLabel,
}: SeriesFilterProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let results = series;
    if (categoryId !== "all") {
      results = results.filter((s) => s.categoryId === categoryId);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter((s) => s.title.toLowerCase().includes(q));
    }
    return results;
  }, [series, categoryId, query]);

  return (
    <>
      {/* Filter bar */}
      <div className="mb-8 rounded-xl border border-stone-200 bg-[var(--bg-surface-elevated)] p-3 shadow-sm dark:border-stone-800 dark:bg-[var(--bg-surface)] sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="col-span-full flex items-center gap-2 md:hidden">
            <button
              type="button"
              aria-label={searchPlaceholder}
              aria-expanded={mobileSearchOpen}
              aria-controls="series-mobile-search"
              onClick={() => setMobileSearchOpen((open) => !open)}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${mobileSearchOpen || query ? "border-emerald-800 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-stone-300 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"}`}
            >
              <Search className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={filterLabel}
              aria-expanded={mobileFiltersOpen}
              aria-controls="series-mobile-filter"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${mobileFiltersOpen || categoryId !== "all" ? "border-emerald-800 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-stone-300 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"}`}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {categoryId !== "all" && <span className="absolute -end-1 -top-1 size-2.5 rounded-full bg-emerald-700 ring-2 ring-[var(--bg-surface-elevated)]" />}
            </button>
          </div>
          <div id="series-mobile-search" className={`${mobileSearchOpen ? "block" : "hidden"} relative md:col-span-7 md:block`}>
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="min-h-11 w-full rounded-lg border border-stone-300 bg-white py-2 ps-9 pe-3 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />
          </div>
          <div id="series-mobile-filter" className={`${mobileFiltersOpen ? "block" : "hidden"} md:col-span-5 md:block`}>
            <select
              aria-label={allCategoriesLabel}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="min-h-11 w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
            >
              <option value="all">{allCategoriesLabel}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {mobileFiltersOpen && (query || categoryId !== "all") && (
              <button type="button" onClick={() => { setQuery(""); setCategoryId("all"); }} className="mt-2 min-h-11 text-xs font-medium text-stone-600 dark:text-stone-300 md:hidden">
                {clearFiltersLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((s) => (
            <SeriesCard key={s.id} series={s} duruusLabel={duruusLabel} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center border border-dashed border-stone-300 dark:border-stone-800 rounded-xl">
          <Layers className="w-10 h-10 mx-auto text-stone-400 mb-3 opacity-60" aria-hidden="true" />
          <p className="font-serif font-bold text-base text-stone-800 dark:text-stone-200">
            {noResultsLabel}
          </p>
        </div>
      )}
    </>
  );
}
