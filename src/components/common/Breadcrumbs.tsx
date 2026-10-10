"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { isRtlLocale } from "@/types/i18n";
import type { Locale } from "@/types/i18n";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const isRtl = isRtlLocale(locale);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center text-xs text-stone-500 dark:text-stone-400 py-3 mb-4 overflow-x-auto whitespace-nowrap"
    >
      <Link href="/" className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors shrink-0">
        {t("home")}
      </Link>

      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <ChevronRight
            className={`w-3.5 h-3.5 mx-2 text-stone-400 shrink-0 ${isRtl ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          {item.href ? (
            <Link
              href={item.href as Parameters<typeof Link>[0]["href"]}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors shrink-0"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-stone-900 dark:text-stone-100 truncate max-w-xs sm:max-w-md">
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}


