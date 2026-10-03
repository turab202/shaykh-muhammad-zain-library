import React from "react";
import { Link } from "@/i18n/navigation";
import type { PublicCategory } from "@/types/library";
import {
  BookOpen,
  Scroll,
  Shield,
  Scale,
  Compass,
  Languages,
  Heart,
  Layers,
  FileText,
  CheckCircle,
  Flame,
  Coins,
  Star,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

// Map of icon name strings → Lucide components.
// The icon name is stored as a string in the Category.icon DB field.
const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Scroll,
  Shield,
  ShieldCheck: Shield,
  Scale,
  Compass,
  Languages,
  PenTool: FileText,
  Heart,
  HeartHandshake: Heart,
  Layers,
  FileText,
  CheckCircle,
  Flame,
  Coins,
  Star,
};

function CategoryIcon({ name }: { name?: string }) {
  const Icon = (name && ICON_MAP[name]) ? ICON_MAP[name] : BookOpen;
  return <Icon className="w-5 h-5" aria-hidden="true" />;
}

interface CategoryCardProps {
  category: PublicCategory;
  /** Pre-resolved Arabic subtitle shown below the name in non-Arabic locales */
  arabicName?: string;
}

/**
 * Category card — pure presentational Server Component.
 * Accepts pre-resolved strings; no i18n or LanguageContext dependency.
 */
export function CategoryCard({ category, arabicName }: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex flex-col justify-between p-5 bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] border border-stone-200/80 dark:border-stone-800/80 rounded-xl hover:border-emerald-800/40 dark:hover:border-emerald-700/50 hover:shadow-sm transition-all"
    >
      <div>
        {/* Icon + arrow row */}
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 group-hover:bg-emerald-900 group-hover:text-amber-100 transition-all">
            <CategoryIcon name={category.icon} />
          </div>
          <ArrowRight
            className="w-4 h-4 text-stone-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all"
            aria-hidden="true"
          />
        </div>

        {/* Name */}
        <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors mb-1">
          {category.name}
        </h3>

        {/* Arabic subtitle — shown in non-Arabic locales */}
        {arabicName && (
          <p className="text-xs text-stone-400 dark:text-stone-500 mb-2">
            {arabicName}
          </p>
        )}

        {category.description && (
          <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed mb-4">
            {category.description}
          </p>
        )}
      </div>

      {/* Stats line */}
      {(category.lessonCount !== undefined ||
        category.seriesCount !== undefined ||
        category.bookCount !== undefined) && (
        <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400">
          {category.lessonCount !== undefined && (
            <span className="font-medium text-stone-700 dark:text-stone-300">
              {category.lessonCount} duruus
            </span>
          )}
          {category.seriesCount !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span>{category.seriesCount} series</span>
            </>
          )}
          {category.bookCount !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span>{category.bookCount} books</span>
            </>
          )}
        </div>
      )}
    </Link>
  );
}
