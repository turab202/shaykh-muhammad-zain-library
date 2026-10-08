"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isRtlLocale } from "@/types/i18n";
import type { Locale } from "@/types/i18n";
import { ExternalLink, Send } from "lucide-react";

export function Footer() {
  const tNav = useTranslations("nav");
  const tHero = useTranslations("hero");
  const tFooter = useTranslations("footer");
  const locale = useLocale() as Locale;
  const isRtl = isRtlLocale(locale);
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-stone-200 dark:border-stone-800 bg-[var(--bg-surface-elevated)] text-stone-600 dark:text-stone-400 text-xs transition-colors mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 lg:py-16">
        <div className="hidden md:grid md:grid-cols-4 gap-8 lg:gap-12">

          {/* ── Column 1: Identity ── */}
          <div className="md:col-span-1 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-sm bg-emerald-900 dark:bg-emerald-800 flex items-center justify-center text-amber-100 font-serif font-bold text-xs">
                ز
              </div>
              <span className="font-serif font-bold text-stone-900 dark:text-stone-100 text-sm">
                {isRtl ? "مكتبة الشيخ محمد زين" : "Shaykh Muhammad Zain"}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-xs">
              {tHero("description")}
            </p>
            <div className="pt-2">
              <a
                href="https://t.me/SheikhMuhammedZain"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-stone-200/70 dark:bg-stone-800/80 hover:bg-stone-300/80 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>{tFooter("telegram")}</span>
              </a>
            </div>
          </div>

          {/* ── Column 2: Library Catalog ── */}
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-stone-900 dark:text-stone-200 text-xs tracking-wider uppercase">
              {tFooter("catalog")}
            </h4>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/duruus"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  {tNav("lessons")}
                </Link>
              </li>
              <li>
                <Link
                  href="/series"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  {tNav("series")}
                </Link>
              </li>
              <li>
                <Link
                  href="/kutub"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  {tNav("books")}
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  {tNav("categories")}
                </Link>
              </li>
            </ul>
          </div>

          {/* ── Column 3: Featured Collections ── */}
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-stone-900 dark:text-stone-200 text-xs tracking-wider uppercase">
              {tFooter("collections")}
            </h4>
            {/* These are proper names — not translated, intentionally bilingual */}
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/series/riyad-as-salihin"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  Riyāḍ aṣ-Ṣāliḥīn · رياض الصالحين
                </Link>
              </li>
              <li>
                <Link
                  href="/series/tafsir-ibn-kathir"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  Tafsīr Ibn Kathīr · تفسير ابن كثير
                </Link>
              </li>
              <li>
                <Link
                  href="/series/al-aqeedah-al-wasitiyyah"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  Al-Wāsiṭiyyah · الواسطية
                </Link>
              </li>
              <li>
                <Link
                  href="/series/al-ajrumiyyah"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  Al-Ājurrūmiyyah · الآجرومية
                </Link>
              </li>
            </ul>
          </div>

          {/* ── Column 4: Archive Project ── */}
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-stone-900 dark:text-stone-200 text-xs tracking-wider uppercase">
              {tFooter("archive")}
            </h4>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/about"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  {tNav("about")}
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                >
                  {tNav("search")}
                </Link>
              </li>
            </ul>
          </div>

        </div>

        <div className="md:hidden">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-sm bg-emerald-900 dark:bg-emerald-800 flex items-center justify-center text-amber-100 font-serif font-bold text-xs">
                ز
              </div>
              <span className="font-serif font-bold text-stone-900 dark:text-stone-100 text-sm">
                {isRtl ? "مكتبة الشيخ محمد زين" : "Shaykh Muhammad Zain"}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-xs line-clamp-2">
              {tHero("description")}
            </p>
            <div>
              <a
                href="https://t.me/SheikhMuhammedZain"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-stone-200/70 dark:bg-stone-800/80 hover:bg-stone-300/80 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>{tFooter("telegram")}</span>
              </a>
            </div>
          </div>

          <div className="mt-4 divide-y divide-stone-200/80 dark:divide-stone-800/80 border-y border-stone-200/80 dark:border-stone-800/80">
            <details>
              <summary className="py-3 font-semibold text-stone-900 dark:text-stone-200 text-xs tracking-wider uppercase cursor-pointer">
                {tFooter("catalog")}
              </summary>
              <ul className="pb-3 flex flex-col gap-2">
                <li><Link href="/duruus" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">{tNav("lessons")}</Link></li>
                <li><Link href="/series" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">{tNav("series")}</Link></li>
                <li><Link href="/kutub" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">{tNav("books")}</Link></li>
                <li><Link href="/categories" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">{tNav("categories")}</Link></li>
              </ul>
            </details>

            <details>
              <summary className="py-3 font-semibold text-stone-900 dark:text-stone-200 text-xs tracking-wider uppercase cursor-pointer">
                {tFooter("collections")}
              </summary>
              <ul className="pb-3 flex flex-col gap-2">
                <li><Link href="/series/riyad-as-salihin" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">Riyāḍ aṣ-Ṣāliḥīn · رياض الصالحين</Link></li>
                <li><Link href="/series/tafsir-ibn-kathir" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">Tafsīr Ibn Kathīr · تفسير ابن كثير</Link></li>
                <li><Link href="/series/al-aqeedah-al-wasitiyyah" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">Al-Wāsiṭiyyah · الواسطية</Link></li>
                <li><Link href="/series/al-ajrumiyyah" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">Al-Ājurrūmiyyah · الآجرومية</Link></li>
              </ul>
            </details>

            <details>
              <summary className="py-3 font-semibold text-stone-900 dark:text-stone-200 text-xs tracking-wider uppercase cursor-pointer">
                {tFooter("archive")}
              </summary>
              <ul className="pb-3 flex flex-col gap-2">
                <li><Link href="/about" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">{tNav("about")}</Link></li>
                <li><Link href="/search" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors">{tNav("search")}</Link></li>
              </ul>
            </details>
          </div>
        </div>

        {/* ── Bottom Bar ── */}
        <div className="mt-6 md:mt-12 pt-4 md:pt-6 border-t border-stone-200/80 dark:border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-[11px] text-stone-500 dark:text-stone-400">
          <p>
            © {year} {tFooter("copyright")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center sm:gap-4">
            <span>{tFooter("telegramMirror")}</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span>{tFooter("multilingualNote")}</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span>{tFooter("noCommercial")}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px]">
          <span className="text-stone-500 dark:text-stone-400">{tFooter("developedBy")}</span>
          <a
            href="https://zahra-mustefa.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex flex-wrap items-center justify-center gap-x-1.5 font-semibold text-stone-700 dark:text-stone-200 hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <span>Zahra Mustefa</span>
            <span className="font-normal text-stone-500 dark:text-stone-400">(zahra-mustefa.vercel.app)</span>
            <ExternalLink className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
