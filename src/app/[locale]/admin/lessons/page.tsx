import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { publishLesson, unpublishLesson, deleteLesson } from "@/server/admin/actions";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { EditLessonButton } from "@/components/admin/EditLessonButton";

export default async function AdminLessonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const [lessons, categories, seriesList, books, audioFiles] = await Promise.all([
    prisma.lesson.findMany({
      orderBy: [{ seriesId: "asc" }, { lessonNumber: "asc" }],
      include: {
        series: { select: { title: true, slug: true } },
        category: { select: { name: true } },
          media: {
            where: { mediaType: "AUDIO" },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          },
      },
      take: 100,
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.series.findMany({ orderBy: { order: "asc" }, select: { id: true, title: true } }),
    prisma.book.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.media.findMany({
      where: { mediaType: "AUDIO" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        size: true,
        duration: true,
        lessonId: true,
        lesson: { select: { title: true } },
      },
    }),
  ]);

  const statusColor: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    DRAFT: "bg-stone-100 dark:bg-stone-800 text-stone-500",
    ARCHIVED: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("lessons")}</h1>
        <span className="text-sm text-stone-500">{lessons.length} total</span>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800">
            <tr>
              {["#", "Title", "Series", "Category", "Duration", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-semibold text-stone-600 dark:text-stone-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {lessons.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No lessons yet. Run <code className="bg-stone-100 dark:bg-stone-800 px-1 rounded">npm run db:seed</code> to add sample data.</td></tr>
            ) : lessons.map((l) => (
              <tr key={l.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                <td className="px-4 py-3 font-mono text-stone-400">{l.lessonNumber ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-stone-800 dark:text-stone-200 max-w-[220px] truncate">{l.title}</td>
                <td className="px-4 py-3 text-stone-500 max-w-[150px] truncate">{l.series?.title ?? "—"}</td>
                <td className="px-4 py-3 text-stone-500">{l.category?.name ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-stone-400">{l.duration ? `${Math.floor(l.duration / 60)}m` : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusColor[l.status] ?? ""}`}>{l.status}</span>
                </td>
                <td className="px-4 py-3 flex items-center gap-2">
                  {l.status !== "PUBLISHED" ? (
                    <form action={publishLesson.bind(null, l.id)} className="inline">
                      <button type="submit" className="text-emerald-700 hover:underline cursor-pointer">Publish</button>
                    </form>
                  ) : (
                    <form action={unpublishLesson.bind(null, l.id)} className="inline">
                      <button type="submit" className="text-amber-600 hover:underline cursor-pointer">Unpublish</button>
                    </form>
                  )}
                  <Link href={`/duruus/${l.slug}`} className="text-blue-600 hover:underline">View</Link>
                  <EditLessonButton
                    lesson={{
                      id: l.id,
                      slug: l.slug,
                      title: l.title,
                      translations: (l.translations as Record<string, string>) ?? {},
                      description: l.description ?? null,
                      descTranslations: (l.descTranslations as Record<string, string>) ?? {},
                      lessonNumber: l.lessonNumber ?? null,
                      duration: l.duration ?? null,
                      status: l.status,
                      publishedAt: l.publishedAt ? l.publishedAt.toISOString() : null,
                      categoryId: l.categoryId ?? null,
                      seriesId: l.seriesId ?? null,
                      bookId: l.bookId ?? null,
                      audioMediaId: l.media[0]?.id ?? null,
                    }}
                    categories={categories}
                    seriesList={seriesList}
                    books={books}
                    audioFiles={audioFiles.map((media) => ({
                      id: media.id,
                      filename: media.filename,
                      size: media.size,
                      duration: media.duration,
                      lessonId: media.lessonId,
                      lessonTitle: media.lesson?.title ?? null,
                    }))}
                  />
                  <DeleteButton action={deleteLesson.bind(null, l.id)} label="Del" itemName={l.title} itemType="lesson" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
