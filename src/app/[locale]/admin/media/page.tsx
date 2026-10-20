import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Headphones, BookOpen, CheckCircle, FileAudio, AlertTriangle } from "lucide-react";
import { AudioUploadRow } from "./AudioUploadRow";
import { AdminPageHeading, AdminSummaryGrid } from "@/components/admin/AdminPageChrome";

export const revalidate = 60;

export default async function AdminMediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  await getTranslations({ locale, namespace: "admin" });

  // Lessons WITHOUT audio, grouped by series — most recent first
  const lessonsWithoutAudio = await prisma.lesson.findMany({
    where: {
      status: "PUBLISHED",
      media: { none: { mediaType: "AUDIO" } },
    },
    orderBy: [{ seriesId: "asc" }, { lessonNumber: "asc" }],
    include: {
      series: { select: { title: true, slug: true } },
      telegramSource: { select: { messageId: true, audioFilename: true } },
    },
    take: 200,
  });

  // Lessons WITH audio
  const withAudio = await prisma.lesson.count({
    where: {
      status: "PUBLISHED",
      media: { some: { mediaType: "AUDIO" } },
    },
  });

  const total = await prisma.lesson.count({ where: { status: "PUBLISHED" } });

  // Group by series
  const bySeries = new Map<string, typeof lessonsWithoutAudio>();
  for (const l of lessonsWithoutAudio) {
    const key = l.series?.title ?? "No Series";
    if (!bySeries.has(key)) bySeries.set(key, []);
    bySeries.get(key)!.push(l);
  }

  return (
    <div className="mx-auto max-w-360 space-y-6">
      <AdminPageHeading title="Audio Coverage" description="Upload audio for published lessons that do not have a recording yet." icon={Headphones}
        action={<a href="https://github.com/turab202/shaykh-muhammad-zain-library/actions" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 sm:w-auto dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800">Bulk import workflow <span aria-hidden="true">↗</span></a>} />

      <AdminSummaryGrid items={[
        { label: "With audio", value: withAudio, icon: CheckCircle },
        { label: "Missing audio", value: total - withAudio, icon: AlertTriangle, tone: "amber" },
        { label: "Total published", value: total, icon: FileAudio, tone: "blue" },
        { label: "Groups needing audio", value: bySeries.size, icon: BookOpen, tone: "red" },
      ]} />

      {/* Lessons without audio, by series */}
      {lessonsWithoutAudio.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-emerald-300 rounded-2xl">
          <CheckCircle className="mx-auto mb-3 size-9 text-emerald-500" />
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">All published lessons have audio.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(bySeries.entries()).map(([seriesTitle, seriesLessons]) => (
            <div key={seriesTitle} className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-4 dark:border-stone-800 dark:bg-stone-950/50">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-5 text-emerald-800 dark:text-emerald-300" />
                  <span className="text-base font-semibold text-stone-800 dark:text-stone-200">{seriesTitle}</span>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{seriesLessons.length} missing</span>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {seriesLessons.map((lesson) => (
                  <AudioUploadRow
                    key={lesson.id}
                    lessonId={lesson.id}
                    lessonNumber={lesson.lessonNumber ?? 0}
                    title={lesson.title}
                    slug={lesson.slug}
                    telegramMessageId={lesson.telegramSource?.messageId ?? null}
                    audioFilename={lesson.telegramSource?.audioFilename ?? null}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
