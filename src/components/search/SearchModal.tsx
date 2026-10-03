"use client";

/**
 * SearchModal — Quick search UI (⌘K)
 *
 * TEMPORARY SEARCH IMPLEMENTATION
 * ─────────────────────────────────
 * This component currently shows an empty-result state for all queries.
 * Real search will be implemented in Stage H using PostgreSQL full-text
 * search via a /api/search Route Handler.
 *
 * To wire up real search, replace the `results` constant below with a
 * fetch call to `/api/search?q={query}&locale={locale}`.
 *
 * The "Popular Disciplines" section shows static placeholder chips until
 * real category data is available from the database.
 */

import React, { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Search, X, BookOpen, Layers, FileText, Compass, Clock } from "lucide-react";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Static discipline chips — replaced by real Category data in Stage H.
const PLACEHOLDER_DISCIPLINES = [
  { id: "hadith", labelEn: "Hadith", labelAr: "الحديث", labelAm: "ሐዲስ" },
  { id: "tafsir", labelEn: "Tafsir", labelAr: "التفسير", labelAm: "ተፍሲር" },
  { id: "aqeedah", labelEn: "Aqeedah", labelAr: "العقيدة", labelAm: "ዐቂዳ" },
  { id: "fiqh", labelEn: "Fiqh", labelAr: "الفقه", labelAm: "ፊቅህ" },
  { id: "arabic", labelEn: "Arabic Language", labelAr: "اللغة العربية", labelAm: "አረብኛ ቋንቋ" },
  { id: "seerah", labelEn: "Seerah", labelAr: "السيرة", labelAm: "ሲራ" },
] as const;

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const t = useTranslations("search");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage on mount.
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    try {
      const saved = localStorage.getItem("library_recent_searches");
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        // Defer to avoid "setState synchronously within effect" warning
        id = setTimeout(() => setRecentSearches(parsed), 0);
      }
    } catch {
      // ignore
    }
    return () => clearTimeout(id);
  }, []);

  // Reset query when modal closes.
  useEffect(() => {
    if (!isOpen) {
      const id = setTimeout(() => setQuery(""), 0);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // Focus input when modal opens.
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global ⌘K / Ctrl+K keyboard shortcut.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
        // Opening is handled by Header — this just toggles close.
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ── TEMPORARY: always empty until Stage H wires real search ──
  // Replace this with: const results = await fetch(`/api/search?q=${query}`)
  const results = query.trim()
    ? { lessons: [], series: [], books: [], totalCount: 0 }
    : null;
  // ─────────────────────────────────────────────────────────────

  const getDisciplineLabel = (d: (typeof PLACEHOLDER_DISCIPLINES)[number]) => {
    if (locale === "ar") return d.labelAr;
    if (locale === "am") return d.labelAm;
    return d.labelEn;
  };

  const handleCommitSearch = () => {
    const q = query.trim();
    if (!q) return;
    // Persist to recent searches.
    try {
      const next = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 8);
      setRecentSearches(next);
      localStorage.setItem("library_recent_searches", JSON.stringify(next));
    } catch {
      // ignore
    }
    onClose();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-2xl bg-[var(--bg-parchment)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t("quick")}
      >
        {/* Input bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-200 dark:border-stone-800">
          <Search className="w-5 h-5 text-stone-400 dark:text-stone-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommitSearch();
            }}
            placeholder={t("placeholder")}
            className="w-full bg-transparent text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none"
            aria-label={t("placeholder")}
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              aria-label={t("placeholder")}
              className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-stone-400 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded shrink-0">
              ESC
            </kbd>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4">

          {/* No query — show recent searches + disciplines */}
          {!query.trim() && (
            <div>
              {recentSearches.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2.5">
                    {t("recent")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => setQuery(term)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
                      >
                        <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
                {t("popularDisciplines")}
              </div>
              {/* TEMPORARY: static chips — replace with real Category query in Stage H */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PLACEHOLDER_DISCIPLINES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setQuery(getDisciplineLabel(d))}
                    className="p-2.5 rounded-lg border border-stone-200/80 dark:border-stone-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors text-start"
                  >
                    {getDisciplineLabel(d)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Query active — temporary empty state */}
          {results && results.totalCount === 0 && (
            <div className="py-12 text-center text-stone-400 dark:text-stone-500">
              <Compass className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">{t("noResults")}</p>
              <p className="text-xs mt-1">{t("tryExample")}</p>
              {/* TEMPORARY NOTE: Full-text search will be wired in Stage H */}
            </div>
          )}

        </div>

        {/* Footer — commit search */}
        {query.trim() && (
          <div className="p-3 bg-stone-50 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500">
            <span>
              {t("enterForFull")} —{" "}
              <kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-800 rounded font-mono">
                Enter
              </kbd>
            </span>
            <button
              onClick={handleCommitSearch}
              className="text-emerald-800 dark:text-emerald-400 font-semibold hover:underline"
            >
              {t("seeAll")} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
