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
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">{title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function AdminSummaryGrid({ items }: { items: { label: string; value: number | string; icon: LucideIcon; tone?: "green" | "blue" | "amber" | "red" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Summary statistics">
      {items.map(({ label, value, icon: Icon, tone = "green" }) => {
        const colors = {
          green: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
          blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
          amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
          red: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
        };
        return (
          <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-4 dark:border-stone-800 dark:bg-stone-900 sm:gap-4 sm:px-5">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${colors[tone]}`}>
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none tabular-nums text-stone-900 dark:text-stone-100">{value}</p>
              <p className="mt-1.5 truncate text-xs font-medium text-stone-600 dark:text-stone-400">{label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
