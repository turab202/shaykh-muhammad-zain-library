import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminBreadcrumb, AdminNavigationLink } from "@/components/admin/AdminNavigation";

// Force dynamic so server action hashes never go stale after redeploy
export const dynamic = "force-dynamic";
import {
  LayoutDashboard, Layers, BookOpen, FileText, Headphones, Upload, LogOut, Settings, Languages,
} from "lucide-react";
import { logout } from "@/server/auth/actions";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }

  const t = await getTranslations({ locale, namespace: "admin" });

  const navItems = [
    { href: "/admin", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/categories", label: t("categories"), icon: Layers },
    { href: "/admin/series", label: t("series"), icon: Layers },
    { href: "/admin/books", label: t("books"), icon: BookOpen },
    { href: "/admin/lessons", label: t("lessons"), icon: FileText },
    { href: "/admin/media", label: t("media"), icon: Headphones },
    { href: "/admin/import", label: t("imports"), icon: Upload },
    { href: "/admin/site-content", label: "Website Content", icon: Languages },
    { href: "/admin/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 lg:flex-row">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-e border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-stone-200 px-5 py-5 dark:border-stone-800">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <BookOpen className="size-5" aria-hidden="true" />
            </div>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-stone-800 transition-colors group-hover:text-emerald-800 dark:text-stone-100 dark:group-hover:text-emerald-300">مكتبة الشيخ محمد زين</span>
              <span className="mt-1 block truncate text-xs text-stone-500 dark:text-stone-400">Islamic Digital Library</span>
            </span>
          </Link>
        </div>
        <nav aria-label="Admin navigation" className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <AdminNavigationLink key={href} href={href}>
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </AdminNavigationLink>
          ))}
        </nav>
        <div className="border-t border-stone-200 p-4 dark:border-stone-800">
          <form action={logout}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-stone-400 dark:hover:bg-red-950/20 dark:hover:text-red-400">
              <LogOut className="size-5 shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900 sm:px-7">
          <AdminBreadcrumb items={navItems.map(({ href, label }) => ({ href, label }))} />
          <Link href="/" className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 hover:underline dark:text-emerald-300 dark:hover:bg-emerald-950/40">Public site ↗</Link>
        </header>
        <nav aria-label="Admin navigation" className="sticky top-0 z-30 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-stone-200 bg-white px-2 py-2 dark:border-stone-800 dark:bg-stone-900 lg:hidden">
          {navItems.map(({ href, label, icon: Icon }) => (
            <AdminNavigationLink key={href} href={href} mobile>
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </AdminNavigationLink>
          ))}
          <form action={logout} className="shrink-0">
            <button type="submit" className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-red-50 hover:text-red-700 dark:text-stone-300 dark:hover:bg-red-950/20 dark:hover:text-red-400">
              <LogOut className="size-5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </nav>
        <main className="min-w-0 flex-1 p-4 sm:p-7 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
