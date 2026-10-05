import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Force dynamic so server action hashes never go stale after redeploy
export const dynamic = "force-dynamic";
import {
  LayoutDashboard, Layers, BookOpen, FileText, Headphones, Upload, LogOut, Settings,
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
    { href: "/admin/settings", label: t("settings"), icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-stone-50 dark:bg-stone-950">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-white dark:bg-stone-900 border-e border-stone-200 dark:border-stone-800 flex-col">
        <div className="p-4 border-b border-stone-200 dark:border-stone-800">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-sm bg-emerald-900 flex items-center justify-center text-amber-100 font-serif font-bold text-sm">ز</div>
            <span className="text-xs font-bold text-stone-700 dark:text-stone-200 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors">{t("dashboard")}</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href as Parameters<typeof Link>[0]["href"]} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
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
        <header className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs sm:text-sm font-semibold text-stone-700 dark:text-stone-200">مكتبة الشيخ محمد زين — {t("dashboard")}</span>
          <Link href="/" className="shrink-0 whitespace-nowrap text-xs text-emerald-700 dark:text-emerald-400 hover:underline">← Public site</Link>
        </header>
        <nav aria-label="Admin navigation" className="md:hidden flex gap-1 px-3 py-2 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 overflow-x-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href as Parameters<typeof Link>[0]["href"]} className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800">
              <Icon className="w-4 h-4" aria-hidden="true" />
              {label}
            </Link>
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
