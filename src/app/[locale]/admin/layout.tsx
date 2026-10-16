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
    <div className="min-h-screen flex flex-col md:flex-row bg-stone-50 dark:bg-stone-950">
      {/* Sidebar */}
      <aside className="hidden w-44 shrink-0 flex-col border-e border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 md:flex">
        <div className="border-b border-stone-200 px-3 py-3 dark:border-stone-800">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <BookOpen className="size-5" aria-hidden="true" />
            </div>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-bold text-stone-800 transition-colors group-hover:text-emerald-800 dark:text-stone-100 dark:group-hover:text-emerald-300">مكتبة الشيخ محمد زين</span>
              <span className="mt-0.5 block truncate text-[9px] text-stone-500 dark:text-stone-400">Islamic Digital Library</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <AdminNavigationLink key={href} href={href}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </AdminNavigationLink>
          ))}
        </nav>
        <div className="p-3 border-t border-stone-200 dark:border-stone-800">
          <form action={logout}>
            <button type="submit" className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 dark:hover:text-red-400 transition-colors cursor-pointer">
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900 sm:px-6">
          <AdminBreadcrumb items={navItems.map(({ href, label }) => ({ href, label }))} />
          <Link href="/" className="shrink-0 whitespace-nowrap text-xs font-medium text-emerald-800 hover:underline dark:text-emerald-300">Public site ↗</Link>
        </header>
        <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-2 py-2 dark:border-stone-800 dark:bg-stone-900 md:hidden">
          {navItems.map(({ href, label, icon: Icon }) => (
            <AdminNavigationLink key={href} href={href} mobile>
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </AdminNavigationLink>
          ))}
          <form action={logout} className="shrink-0">
            <button type="submit" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 dark:hover:text-red-400">
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </nav>
        <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
