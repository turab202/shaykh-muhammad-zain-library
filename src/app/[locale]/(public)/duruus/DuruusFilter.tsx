"use client";

import { useState, useMemo } from "react";
import { Link } from "@/i18n/navigation";
import {
  Search,
  X,
  BookOpen,
  Layers,
  List,
  Grid3X3,
  FolderOpen,
  ArrowRight,
  FileText,
} from "lucide-react";
import { LessonCard } from "@/components/cards/LessonCard";
import type { PublicLesson, PublicCategory, PublicSeries } from "@/types/library";

interface DuruusFilterLabels {
  searchPlaceholder: string;
  allCategories: string;
  allSeries: string;
  sortLessonNumber: string;
  sortNewest: string;
  sortOldest: string;
  sortTitle: string;
  viewBySeries: string;
  viewGrid: string;
  viewList: string;
  clearFilters: string;
  noResults: string;
  noResultsHint: string;
  showingPrefix: string;
  exploreDiscipline: string;
  disciplineContextHint: string;
  seriesCollection: string;
  duruusLabel: string;
  bookAvailableLabel: string;
  listenLabel: string;
  exploreLabel: string;
}

interface DuruusFilterProps {
  lessons: PublicLesson[];
  categories: PublicCategory[];
  seriesList: PublicSeries[];
  labels: DuruusFilterLabels;
}

type SortKey = "lesson_number" | "newest" | "oldest" | "title";
type ViewMode = "grouped" | "row" | "card";

export function DuruusFilter({
  lessons,
  categories,
  seriesList,
  labels,
}: DuruusFilterProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [seriesId, setSeriesId] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("lesson_number");
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");

  // Series filtered by selected category
  const availableSeries = useMemo(
    () =>
      categoryId === "all"
        ? seriesList
        : seriesList.filter((s) => s.categoryId === categoryId),
    [seriesList, categoryId]
  );

  const filteredLessons = useMemo(() => {
    let r = lessons;
    if (categoryId !== "all") r = r.filter((l) => l.categoryId === categoryId);
    if (seriesId !== "all") r = r.filter((l) => l.seriesId === seriesId);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((l) => l.title.toLowerCase().includes(q));
    }
    if (sortBy === "newest") {
      r = [...r].sort(
        (a, b) =>
          new Date(b.publishedAt ?? "").getTime() -
          new Date(a.publishedAt ?? "").getTime()
      );
    } else if (sortBy === "oldest") {
      r = [...r].sort(
        (a, b) =>
          new Date(a.publishedAt ?? "").getTime() -
          new Date(b.publishedAt ?? "").getTime()
      );
    } else if (sortBy === "title") {
      r = [...r].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      r = [...r].sort((a, b) => (a.lessonNumber ?? 0) - (b.lessonNumber ?? 0));
    }
    return r;
  }, [lessons, categoryId, seriesId, query, sortBy]);

  // Group by series for grouped view
  const groupedLessons = useMemo(() => {
    const map = new Map<string, PublicLesson[]>();
    filteredLessons.forEach((l) => {
      const key = l.seriesId ?? "standalone";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return Array.from(map.entries()).map(([sId, items]) => ({
      series: seriesList.find((s) => s.id === sId),
      lessons: [...items].sort(
        (a, b) => (a.lessonNumber ?? 0) - (b.lessonNumber ?? 0)
      ),
    }));
  }, [filteredLessons, seriesList]);

  const hasActiveFilters =
    query || categoryId !== "all" || seriesId !== "all";

  const currentCategory =
    categoryId !== "all" ? categories.find((c) => c.id === categoryId) : null;

  const resetFilters = () => {
    setQuery("");
    setCategoryId("all");
    setSeriesId("all");
    setSortBy("lesson_number");
  };

  return (
    <>
      {/* Category context banner */}
      {currentCategory && (
        <div className="mb-6 p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-900 text-amber-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                {currentCategory.name}
              </h4>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
                {labels.disciplineContextHint}
              </p>
            </div>
          </div>
          <Link
            href={`/categories/${currentCategory.slug}`}
            className="px-3 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-100 text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5"
          >
            {labels.exploreDiscipline}
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-[var(--bg-surface-elevated)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-xl p-4 sm:p-5 mb-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.searchPlaceholder}
              className="w-full ps-9 pe-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            />
          </div>

          {/* Category */}
          <div className="md:col-span-3">
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSeriesId("all");
              }}
              className="w-full py-2 px-3 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-700 dark:text-stone-300 focus:outline-none cursor-pointer"
            >
              <option value="all">{labels.allCategories}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Series */}
          <div className="md:col-span-3">
            <select
              value={seriesId}
              onChange={(e) => setSeriesId(e.target.value)}
              className="w-full py-2 px-3 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-700 dark:text-stone-300 focus:outline-none cursor-pointer"
            >
              <option value="all">{labels.allSeries}</option>
              {availableSeries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          {/* Sort + view mode */}
          <div className="md:col-span-2 flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="flex-1 py-2 px-3 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-700 dark:text-stone-300 focus:outline-none cursor-pointer"
            >
              <option value="lesson_number">{labels.sortLessonNumber}</option>
              <option value="newest">{labels.sortNewest}</option>
              <option value="oldest">{labels.sortOldest}</option>
              <option value="title">{labels.sortTitle}</option>
            </select>

            {/* View mode toggle */}
            <div className="flex items-center p-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700">
              {(["grouped", "row", "card"] as ViewMode[]).map((mode) => {
                const Icon =
                  mode === "grouped" ? FolderOpen : mode === "row" ? List : Grid3X3;
                const label =
                  mode === "grouped"
                    ? labels.viewBySeries
                    : mode === "row"
                    ? labels.viewList
                    : labels.viewGrid;
                return (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    title={label}
                    aria-label={label}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewMode === mode
                        ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
                        : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active filters info */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-200/60 dark:border-stone-800/60 text-xs">
            <span className="text-stone-500">
              {labels.showingPrefix}
              {filteredLessons.length}
            </span>
            <button
              onClick={resetFilters}
              className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              {labels.clearFilters}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {filteredLessons.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-stone-300 dark:border-stone-800 rounded-xl">
          <BookOpen className="w-10 h-10 mx-auto text-stone-400 mb-3 opacity-60" aria-hidden="true" />
          <h3 className="font-serif font-bold text-base text-stone-800 dark:text-stone-200">
            {labels.noResults}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            {labels.noResultsHint}
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-stone-800 dark:text-stone-200"
          >
            {labels.clearFilters}
          </button>
        </div>
      ) : viewMode === "grouped" ? (
        <div className="space-y-8">
          {groupedLessons.map(({ series, lessons: groupItems }) => (
            <div
              key={series?.id ?? "standalone"}
              className="bg-[var(--bg-surface-elevated)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Series header */}
              {series && (
                <div className="p-5 sm:p-6 border-b border-stone-200/80 dark:border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-stone-900/60">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                        {labels.seriesCollection}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-mono">
                        {groupItems.length} {labels.duruusLabel}
                      </span>
                      {series.bookId && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                          <FileText className="w-3 h-3" aria-hidden="true" />
                          {labels.bookAvailableLabel}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif font-bold text-lg sm:text-xl text-stone-900 dark:text-stone-100">
                      {series.title}
                    </h3>
                  </div>

                  <Link
                    href={`/series/${series.slug}`}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-100 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
                  >
                    {labels.exploreLabel}
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </div>
              )}

              {/* Lessons */}
              <div className="p-4 sm:p-5 flex flex-col gap-2">
                {groupItems.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} viewMode="row" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "row" ? (
        <div className="flex flex-col gap-2.5">
          {filteredLessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} viewMode="row" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} viewMode="card" />
          ))}
        </div>
      )}
    </>
  );
}
