import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function AdminPageHeading({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{title}</h1>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function AdminSummaryGrid({ items }: { items: { label: string; value: number | string; icon: LucideIcon; tone?: "green" | "blue" | "amber" | "red" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4" aria-label="Summary statistics">
      {items.map(({ label, value, icon: Icon, tone = "green" }) => {
        const colors = {
          green: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
          blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
          amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
          red: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
        };
        return (
          <div key={label} className="flex min-w-0 items-center gap-2.5 rounded-md border border-stone-200 bg-white px-3 py-3 dark:border-stone-800 dark:bg-stone-900 sm:gap-3 sm:px-4">
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${colors[tone]}`}>
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none tabular-nums text-stone-800 dark:text-stone-100">{value}</p>
              <p className="mt-1 truncate text-[9px] text-stone-500 dark:text-stone-400 sm:text-[10px]">{label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
