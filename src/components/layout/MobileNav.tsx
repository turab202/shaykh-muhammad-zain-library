"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { useTheme } from "@/lib/context/ThemeContext";
import { isRtlLocale } from "@/types/i18n";
import type { Locale } from "@/types/i18n";
import { X, Search, Globe, Sun, Moon, Send } from "lucide-react";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: { href: string; label: string }[];
  onOpenSearch: () => void;
}

export function MobileNav({
  isOpen,
  onClose,
  navLinks,
  onOpenSearch,
}: MobileNavProps) {
  const tCommon = useTranslations("common");
  const tSearch = useTranslations("search");
  const tNav = useTranslations("nav");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const isRtl = isRtlLocale(locale);

  const languages = [
    { code: "ar" as Locale, label: "عربي" },
    { code: "en" as Locale, label: "EN" },
    { code: "am" as Locale, label: "አማርኛ" },
  ] as const;

  const handleLocaleChange = (next: Locale) => {
    router.replace(pathname, { locale: next });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer — opens from the start edge (left in LTR, right in RTL) */}
      <div
        className={`fixed inset-y-0 ${isRtl ? "end-0" : "start-0"} w-4/5 max-w-sm bg-[var(--bg-parchment)] dark:bg-[var(--bg-parchment)] border-e border-stone-200 dark:border-stone-800 p-6 flex flex-col justify-between shadow-2xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col gap-6">

          {/* Header row */}
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-sm bg-emerald-900 dark:bg-emerald-800 flex items-center justify-center text-amber-100 font-serif font-bold text-sm">
                ز
              </div>
              <span className="font-serif font-bold text-stone-900 dark:text-stone-100 text-sm">
                {isRtl ? "مكتبة الشيخ محمد زين" : "Shaykh Muhammad Zain"}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label={tCommon("close")}
              className="p-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Search */}
          <button
            onClick={onOpenSearch}
            className="flex items-center justify-between w-full px-3 py-2 text-xs text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/80 rounded-md border border-stone-200 dark:border-stone-700/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-stone-400 shrink-0" />
              <span>{tSearch("placeholder")}</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-stone-400 bg-stone-200 dark:bg-stone-900 rounded shrink-0">
              ⌘K
            </kbd>
          </button>

          {/* Nav Links */}
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href as Parameters<typeof Link>[0]["href"]}
                  onClick={onClose}
                  className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-semibold"
                      : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="border-t border-stone-200 dark:border-stone-800 pt-4 flex flex-col gap-3">

          {/* Language toggle */}
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              {tCommon("languageSelect")}
            </span>
            <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-md">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => handleLocaleChange(l.code)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    locale === l.code
                      ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme toggle */}
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span>
              {theme === "dark" ? tCommon("darkMode") : tCommon("lightMode")}
            </span>
            <button
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? tCommon("lightMode") : tCommon("darkMode")
              }
              className="p-1.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Telegram channel link */}
          <a
            href="https://t.me/SheikhMuhammedZain"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span>{tNav("telegramChannel")}</span>
          </a>
        </div>
      </div>
    </div>
  );
}


