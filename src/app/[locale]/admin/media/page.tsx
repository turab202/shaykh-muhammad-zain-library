import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Headphones, BookOpen, CheckCircle, XCircle } from "lucide-react";
import { AudioUploadRow } from "./AudioUploadRow";

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
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Headphones className="w-5 h-5 text-emerald-700" />
          Audio Coverage
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          Upload MP3 files for lessons that are missing audio.
          For bulk import, use the{" "}
          <a href="https://github.com/turab202/shaykh-muhammad-zain-library/actions"
             target="_blank" rel="noopener noreferrer"
             className="text-emerald-700 hover:underline">
            GitHub Actions workflow
          </a>.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">{withAudio}</div>
          <div className="text-xs text-stone-500 mt-0.5 flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> With Audio
          </div>
        </div>
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{total - withAudio}</div>
          <div className="text-xs text-stone-500 mt-0.5 flex items-center justify-center gap-1">
            <XCircle className="w-3 h-3 text-amber-500" /> Missing Audio
          </div>
        </div>
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-stone-700">{total}</div>
          <div className="text-xs text-stone-500 mt-0.5">Total Published</div>
        </div>
      </div>

      {/* Lessons without audio, by series */}
      {lessonsWithoutAudio.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-emerald-300 rounded-2xl">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="font-semibold text-emerald-800">All lessons have audio!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(bySeries.entries()).map(([seriesTitle, seriesLessons]) => (
            <div key={seriesTitle} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-700" />
                  <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">{seriesTitle}</span>
                </div>
                <span className="text-xs text-stone-500">{seriesLessons.length} missing</span>
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
