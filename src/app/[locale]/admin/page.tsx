import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { Layers, BookOpen, FileText, Upload, AlertCircle, LayoutDashboard } from "lucide-react";
import { AdminPageHeading } from "@/components/admin/AdminPageChrome";

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const [lessons, series, books, pendingImports] = await Promise.all([
    prisma.lesson.count(),
    prisma.series.count(),
    prisma.book.count(),
    prisma.telegramMessage.count({ where: { processedAt: null } }),
  ]);

  const recentLessons = await prisma.lesson.findMany({
    orderBy: { createdAt: "desc" }, take: 5,
    select: { id: true, title: true, status: true, createdAt: true, slug: true },
  });

  const stats = [
    { label: t("totalLessons"), value: lessons, href: "/admin/lessons", icon: FileText, color: "text-emerald-700 dark:text-emerald-400" },
    { label: t("totalSeries"), value: series, href: "/admin/series", icon: Layers, color: "text-blue-700 dark:text-blue-400" },
    { label: t("totalBooks"), value: books, href: "/admin/books", icon: BookOpen, color: "text-emerald-700 dark:text-emerald-400" },
    { label: t("needsReview"), value: pendingImports, href: "/admin/import", icon: Upload, color: pendingImports > 0 ? "text-red-600 dark:text-red-400" : "text-stone-500 dark:text-stone-400" },
  ];

  return (
    <div className="mx-auto max-w-360 space-y-4">
      <AdminPageHeading title={t("dashboard")} description="مكتبة الشيخ محمد زين حفظه الله" icon={LayoutDashboard} />

      {pendingImports > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-900 dark:bg-amber-950/30">
          <AlertCircle className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <span className="text-amber-900 dark:text-amber-200">{pendingImports} Telegram message{pendingImports !== 1 ? "s" : ""} awaiting review.</span>
          <Link href="/admin/import" className="ms-auto text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline">{t("importTitle")} →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, href, icon: Icon, color }) => (
          <Link key={href} href={href as Parameters<typeof Link>[0]["href"]} className="group flex min-w-0 items-center gap-3 rounded-md border border-stone-200 bg-white px-3 py-3 transition-colors hover:border-emerald-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-emerald-800 sm:px-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50"><Icon className={`size-4 ${color}`} aria-hidden="true" /></div>
            <div className="min-w-0"><div className="text-sm font-bold tabular-nums text-stone-900 dark:text-stone-100">{value}</div><div className="mt-0.5 truncate text-[9px] text-stone-500 dark:text-stone-400 sm:text-[10px]">{label}</div></div>
          </Link>
        ))}
      </div>

      {/* Recent lessons */}
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800 sm:px-5">
          <h2 className="text-xs font-semibold text-stone-900 dark:text-stone-100">{t("recentActivity")}</h2>
          <Link href="/admin/lessons" className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">{t("lessons")} →</Link>
        </div>
        {recentLessons.length === 0 ? (
          <p className="p-5 text-xs text-stone-500">No lessons yet. <Link href="/admin/lessons" className="font-medium text-emerald-800 hover:underline dark:text-emerald-300">Add one →</Link></p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {recentLessons.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs sm:px-5">
                <Link href={`/admin/lessons`} className="font-medium text-stone-800 dark:text-stone-200 hover:text-emerald-700 dark:hover:text-emerald-400 truncate">{l.title}</Link>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ms-3 ${l.status === "PUBLISHED" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-stone-100 dark:bg-stone-800 text-stone-500"}`}>{l.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {[
          { href: "/admin/categories", label: "Manage Categories" },
          { href: "/admin/series", label: "Manage Series" },
          { href: "/admin/books", label: "Manage Books" },
          { href: "/admin/lessons", label: "Manage Lessons" },
          { href: "/admin/media", label: "Media Library" },
          { href: "/admin/import", label: "Telegram Inbox" },
        ].map(({ href, label }) => (
          <Link key={href} href={href as Parameters<typeof Link>[0]["href"]} className="rounded-md border border-stone-200 bg-white p-3 text-center text-[10px] font-medium text-stone-700 transition-colors hover:border-emerald-300 hover:text-emerald-800 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-emerald-800 dark:hover:text-emerald-300 sm:text-xs">{label}</Link>
        ))}
      </div>
    </div>
  );
}
