"use client";

import { useState, useMemo } from "react";
import { Search, BookOpen } from "lucide-react";
import { BookCard } from "@/components/cards/BookCard";
import type { PublicBook, PublicCategory } from "@/types/library";

interface BooksFilterProps {
  books: PublicBook[];
  categories: PublicCategory[];
  duruusLabel: string;
  pdfLabel: string;
  allCategoriesLabel: string;
  searchPlaceholder: string;
  noResultsLabel: string;
}

export function BooksFilter({
  books,
  categories,
  duruusLabel,
  pdfLabel,
  allCategoriesLabel,
  searchPlaceholder,
  noResultsLabel,
}: BooksFilterProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");

  const filtered = useMemo(() => {
    let results = books;
    if (categoryId !== "all") {
      results = results.filter((b) => b.categoryId === categoryId);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author ?? "").toLowerCase().includes(q)
      );
    }
    return results;
  }, [books, categoryId, query]);

  return (
    <>
      {/* Filter bar */}
      <div className="bg-[var(--bg-surface-elevated)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-xl p-4 sm:p-5 mb-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full ps-9 pe-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            />
          </div>
          <div className="md:col-span-5">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full py-2 px-3 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-700 dark:text-stone-300 focus:outline-none cursor-pointer"
            >
              <option value="all">{allCategoriesLabel}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              duruusLabel={duruusLabel}
              pdfLabel={pdfLabel}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center border border-dashed border-stone-300 dark:border-stone-800 rounded-xl">
          <BookOpen className="w-10 h-10 mx-auto text-stone-400 mb-3 opacity-60" aria-hidden="true" />
          <p className="font-serif font-bold text-base text-stone-800 dark:text-stone-200">
            {noResultsLabel}
          </p>
        </div>
      )}
    </>
  );
}
