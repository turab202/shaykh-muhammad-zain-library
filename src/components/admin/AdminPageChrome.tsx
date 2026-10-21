import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function AdminPageHeading({
  title,
  description,
  icon: Icon,
  action,
  compact = false,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col justify-between sm:flex-row sm:items-center ${compact ? "gap-4" : "gap-5"}`}>
      <div className={`flex min-w-0 items-center ${compact ? "gap-3" : "gap-4"}`}>
        <div className={`flex shrink-0 items-center justify-center bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 ${compact ? "size-10 rounded-lg" : "size-12 rounded-xl"}`}>
          <Icon className={compact ? "size-5" : "size-6"} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className={`font-bold text-stone-900 dark:text-stone-100 ${compact ? "text-xl" : "text-2xl tracking-tight"}`}>{title}</h1>
          <p className={compact ? "mt-1 text-xs text-stone-500 dark:text-stone-400" : "mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-400"}>{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function AdminSummaryGrid({ items, compact = false }: { items: { label: string; value: number | string; icon: LucideIcon; tone?: "green" | "blue" | "amber" | "red" }[]; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 ${compact ? "gap-2.5 sm:gap-3" : "gap-3 sm:gap-4"}`} aria-label="Summary statistics">
      {items.map(({ label, value, icon: Icon, tone = "green" }) => {
        const colors = {
          green: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
          blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
          amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
          red: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
        };
        return (
          <div key={label} className={`flex min-w-0 items-center border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900 ${compact ? "gap-2.5 rounded-md px-3 py-3 sm:gap-3 sm:px-4" : "gap-3 rounded-xl px-4 py-4 sm:gap-4 sm:px-5"}`}>
            <div className={`flex shrink-0 items-center justify-center rounded-full ${compact ? "size-8" : "size-10"} ${colors[tone]}`}>
              <Icon className={compact ? "size-4" : "size-5"} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={`font-bold leading-none tabular-nums text-stone-900 dark:text-stone-100 ${compact ? "text-sm" : "text-lg"}`}>{value}</p>
              <p className={compact ? "mt-1 truncate text-[9px] text-stone-500 dark:text-stone-400 sm:text-[10px]" : "mt-1.5 truncate text-xs font-medium text-stone-600 dark:text-stone-400"}>{label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
