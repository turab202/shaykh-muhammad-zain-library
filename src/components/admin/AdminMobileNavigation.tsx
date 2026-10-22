"use client";

import { useRef, useState } from "react";
import { BookOpen, FileText, Globe2, Headphones, Layers, Languages, LayoutDashboard, LogOut, Menu, Settings, Upload, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { AdminBreadcrumb, AdminNavigationLink } from "./AdminNavigation";

type NavigationItem = {
  href: string;
  label: string;
  mobileLabel: string;
};

const iconsByHref: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/categories": Layers,
  "/admin/series": Layers,
  "/admin/books": BookOpen,
  "/admin/lessons": FileText,
  "/admin/media": Headphones,
  "/admin/import": Upload,
  "/admin/site-content": Languages,
  "/admin/settings": Settings,
};

const primaryHrefs = ["/admin/books", "/admin/lessons", "/admin/series", "/admin/media"];

export function AdminMobileNavigation({
  items,
  logoutAction,
}: {
  items: NavigationItem[];
  logoutAction: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const primaryItems = primaryHrefs
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is NavigationItem => item !== undefined);

  function openMenu() {
    setMenuOpen(true);
    requestAnimationFrame(() => {
      if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    });
  }

  function closeMenu() {
    dialogRef.current?.close();
    setMenuOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-stone-200 bg-white px-4 py-2 dark:border-stone-800 dark:bg-stone-900 lg:hidden">
        <button
          type="button"
          aria-label="Open admin menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={openMenu}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <AdminBreadcrumb items={items} />
        <Link
          href="/"
          aria-label="Public site"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
        >
          <Globe2 className="size-5" aria-hidden="true" />
        </Link>
      </header>

      {menuOpen && (
        <dialog
          ref={dialogRef}
          aria-label="Admin menu"
          onClose={() => setMenuOpen(false)}
          onClick={(event) => {
            if (event.target === dialogRef.current) closeMenu();
          }}
          className="fixed inset-y-0 inset-s-0 m-0 flex h-dvh max-h-none w-[min(20rem,85vw)] max-w-none flex-col border-0 bg-white p-0 text-left shadow-2xl backdrop:bg-black/40 dark:bg-stone-900 lg:hidden"
        >
          <div className="flex min-h-16 items-center justify-between border-b border-stone-200 px-5 dark:border-stone-800">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                <BookOpen className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-800 dark:text-stone-100">مكتبة الشيخ محمد زين</p>
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">Islamic Digital Library</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeMenu}
              aria-label="Close admin menu"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Admin sections" className="flex-1 space-y-1 overflow-y-auto p-4">
            {items.map(({ href, label }) => {
              const Icon = iconsByHref[href];
              return (
                <div key={href} onClick={closeMenu}>
                  <AdminNavigationLink href={href}>
                    {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
                    <span className="truncate">{label}</span>
                  </AdminNavigationLink>
                </div>
              );
            })}
          </nav>
          <div className="border-t border-stone-200 p-4 dark:border-stone-800">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:text-stone-400 dark:hover:bg-red-950/20 dark:hover:text-red-400"
              >
                <LogOut className="size-5 shrink-0" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </dialog>
      )}

      <nav
        aria-label="Primary admin navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid min-h-[4.25rem] grid-cols-4 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(28,25,23,0.06)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/95 dark:shadow-black/20 lg:hidden"
      >
        {primaryItems.map(({ href, mobileLabel }) => {
          const Icon = iconsByHref[href];
          const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href as Parameters<typeof Link>[0]["href"]}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 ${
                active
                  ? "text-emerald-800 dark:text-emerald-300 after:absolute after:inset-x-5 after:top-0 after:h-0.5 after:rounded-full after:bg-emerald-700 dark:after:bg-emerald-400"
                  : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
              }`}
            >
              {Icon && <Icon className="size-5" aria-hidden="true" />}
              <span className="max-w-full truncate">{mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
