"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

export function AdminNavigationLink({ href, children, mobile = false }: { href: string; children: ReactNode; mobile?: boolean }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href as Parameters<typeof Link>[0]["href"]}
      aria-current={active ? "page" : undefined}
      className={[
        "flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        mobile ? "shrink-0 whitespace-nowrap" : "w-full",
        active
          ? "bg-emerald-800 text-white shadow-sm dark:bg-emerald-700"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export function AdminBreadcrumb({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const current = [...items].reverse().find(({ href }) => href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="flex min-w-0 items-center gap-2 truncate text-sm text-stone-500 dark:text-stone-400">
      <span className="truncate">مكتبة الشيخ محمد زين</span>
      <span aria-hidden="true">›</span>
      <span className="truncate font-semibold text-stone-800 dark:text-stone-100">{current?.label ?? "Admin"}</span>
    </div>
  );
}