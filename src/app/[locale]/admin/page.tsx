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
    <div className="mx-auto max-w-360 space-y-6">
      <AdminPageHeading title={t("dashboard")} description="مكتبة الشيخ محمد زين حفظه الله" icon={LayoutDashboard} />

      {pendingImports > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm dark:border-amber-900 dark:bg-amber-950/30 sm:px-5">
          <AlertCircle className="size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <span className="text-amber-950 dark:text-amber-100">{pendingImports} Telegram message{pendingImports !== 1 ? "s" : ""} awaiting review.</span>
          <Link href="/admin/import" className="ms-auto inline-flex min-h-10 items-center rounded-lg bg-amber-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-900 dark:bg-amber-700 dark:hover:bg-amber-600">{t("importTitle")} →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, href, icon: Icon, color }) => (
          <Link key={href} href={href as Parameters<typeof Link>[0]["href"]} className="group flex min-h-24 min-w-0 items-center gap-4 rounded-xl border border-stone-200 bg-white px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-emerald-700 sm:px-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50"><Icon className={`size-5 ${color}`} aria-hidden="true" /></div>
            <div className="min-w-0"><div className="text-xl font-bold tabular-nums text-stone-900 dark:text-stone-100">{value}</div><div className="mt-1 truncate text-sm font-medium text-stone-600 dark:text-stone-400">{label}</div></div>
          </Link>
        ))}
      </div>

      {/* Recent lessons */}
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800 sm:px-6">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{t("recentActivity")}</h2>
          <Link href="/admin/lessons" className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 hover:underline dark:text-emerald-400 dark:hover:bg-emerald-950/40">{t("lessons")} →</Link>
        </div>
        {recentLessons.length === 0 ? (
          <p className="p-6 text-sm text-stone-600 dark:text-stone-400">No lessons yet. <Link href="/admin/lessons" className="font-semibold text-emerald-800 hover:underline dark:text-emerald-300">Add one →</Link></p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {recentLessons.map((l) => (
              <div key={l.id} className="flex min-h-14 items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                <Link href="/admin/lessons" className="truncate font-medium text-stone-800 hover:text-emerald-700 dark:text-stone-200 dark:hover:text-emerald-400">{l.title}</Link>
                <span className={`ms-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${l.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"}`}>{l.status === "PUBLISHED" ? "Published" : "Draft"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
