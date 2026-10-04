import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { Layers, BookOpen, FileText, Headphones, Upload, AlertCircle } from "lucide-react";

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const [lessons, series, books, categories, pendingImports] = await Promise.all([
    prisma.lesson.count(),
    prisma.series.count(),
    prisma.book.count(),
    prisma.category.count(),
    prisma.telegramMessage.count({ where: { processedAt: null } }),
  ]);

  const recentLessons = await prisma.lesson.findMany({
    orderBy: { createdAt: "desc" }, take: 5,
    select: { id: true, title: true, status: true, createdAt: true, slug: true },
  });

  const stats = [
    { label: t("totalLessons"), value: lessons, href: "/admin/lessons", icon: FileText, color: "text-emerald-700 dark:text-emerald-400" },
    { label: t("totalSeries"), value: series, href: "/admin/series", icon: Layers, color: "text-blue-700 dark:text-blue-400" },
    { label: t("totalBooks"), value: books, href: "/admin/books", icon: BookOpen, color: "text-amber-700 dark:text-amber-400" },
    { label: t("needsReview"), value: pendingImports, href: "/admin/import", icon: Upload, color: pendingImports > 0 ? "text-red-600 dark:text-red-400" : "text-stone-500 dark:text-stone-400" },
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("dashboard")}</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">مكتبة الشيخ محمد زين حفظه الله</p>
      </div>

      {pendingImports > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span className="text-amber-800 dark:text-amber-200">{pendingImports} Telegram message{pendingImports !== 1 ? "s" : ""} awaiting review.</span>
          <Link href="/admin/import" className="ms-auto text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline">{t("importTitle")} →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, href, icon: Icon, color }) => (
          <Link key={href} href={href as Parameters<typeof Link>[0]["href"]} className="group p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all">
            <Icon className={`w-5 h-5 mb-3 ${color}`} aria-hidden="true" />
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">{value}</div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{label}</div>
          </Link>
        ))}
      </div>

      {/* Recent lessons */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">{t("recentActivity")}</h2>
          <Link href="/admin/lessons" className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">{t("lessons")} →</Link>
        </div>
        {recentLessons.length === 0 ? (
          <p className="p-5 text-sm text-stone-400">No lessons yet. <Link href="/admin/lessons" className="text-emerald-700 hover:underline">Add one →</Link></p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {recentLessons.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <Link href={`/admin/lessons`} className="font-medium text-stone-800 dark:text-stone-200 hover:text-emerald-700 dark:hover:text-emerald-400 truncate">{l.title}</Link>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ms-3 ${l.status === "PUBLISHED" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-stone-100 dark:bg-stone-800 text-stone-500"}`}>{l.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/admin/categories", label: "Manage Categories" },
          { href: "/admin/series", label: "Manage Series" },
          { href: "/admin/books", label: "Manage Books" },
          { href: "/admin/lessons", label: "Manage Lessons" },
          { href: "/admin/media", label: "Media Library" },
          { href: "/admin/import", label: "Telegram Inbox" },
        ].map(({ href, label }) => (
          <Link key={href} href={href as Parameters<typeof Link>[0]["href"]} className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors text-center">{label}</Link>
        ))}
      </div>
    </div>
  );
}
