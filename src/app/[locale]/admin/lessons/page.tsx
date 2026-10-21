import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { publishLesson, unpublishLesson, deleteLesson } from "@/server/admin/actions";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { EditLessonButton } from "@/components/admin/EditLessonButton";
import { AdminPageHeading, AdminSummaryGrid } from "@/components/admin/AdminPageChrome";
import { FileText, Eye, Clock3, Archive, EyeOff, Search, ExternalLink } from "lucide-react";
import { AdminActionMenu, adminActionItemClass } from "@/components/admin/AdminActionMenu";

export default async function AdminLessonsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });
  const query = (await searchParams).q?.trim() ?? "";

  const [lessons, categories, seriesList, books, audioFiles, total, published, drafts, archived] = await Promise.all([
    prisma.lesson.findMany({
      where: query ? { OR: [
        { title: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
        { series: { is: { title: { contains: query, mode: "insensitive" } } } },
        { category: { is: { name: { contains: query, mode: "insensitive" } } } },
      ] } : undefined,
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
    prisma.lesson.count(),
    prisma.lesson.count({ where: { status: "PUBLISHED" } }),
    prisma.lesson.count({ where: { status: "DRAFT" } }),
    prisma.lesson.count({ where: { status: "ARCHIVED" } }),
  ]);

  const editorAudioFiles = audioFiles.map((media) => ({
    id: media.id,
    filename: media.filename,
    size: media.size,
    duration: media.duration,
    lessonId: media.lessonId,
    lessonTitle: media.lesson?.title ?? null,
  }));

  function LessonActions({ lesson }: { lesson: (typeof lessons)[number] }) {
    return <AdminActionMenu itemName={lesson.title} itemType="Lesson">
      {lesson.status !== "PUBLISHED"
        ? <form action={publishLesson.bind(null, lesson.id)}><button type="submit" className={`${adminActionItemClass} text-emerald-800 dark:text-emerald-300`}><Eye className="size-4" aria-hidden="true" />Publish lesson</button></form>
        : <form action={unpublishLesson.bind(null, lesson.id)}><button type="submit" className={`${adminActionItemClass} text-amber-800 dark:text-amber-300`}><EyeOff className="size-4" aria-hidden="true" />Hide lesson</button></form>}
      <Link href={`/duruus/${lesson.slug}`} className={adminActionItemClass}><ExternalLink className="size-4" aria-hidden="true" />View lesson</Link>
      <EditLessonButton lesson={{ id: lesson.id, slug: lesson.slug, title: lesson.title, translations: (lesson.translations as Record<string, string>) ?? {}, description: lesson.description ?? null, descTranslations: (lesson.descTranslations as Record<string, string>) ?? {}, lessonNumber: lesson.lessonNumber ?? null, duration: lesson.duration ?? null, status: lesson.status, publishedAt: lesson.publishedAt?.toISOString() ?? null, categoryId: lesson.categoryId ?? null, seriesId: lesson.seriesId ?? null, bookId: lesson.bookId ?? null, audioMediaId: lesson.media[0]?.id ?? null }} categories={categories} seriesList={seriesList} books={books} audioFiles={editorAudioFiles} menu />
      <DeleteButton action={deleteLesson.bind(null, lesson.id)} itemName={lesson.title} itemType="lesson" menu />
    </AdminActionMenu>;
  }

  return (
    <div className="mx-auto max-w-360 space-y-5 sm:space-y-6">
      <AdminPageHeading title={t("lessons")} description={`Manage lesson metadata and publication · ${total} lessons`} icon={FileText} />
      <AdminSummaryGrid items={[
        { label: "Total lessons", value: total, icon: FileText },
        { label: "Published", value: published, icon: Eye },
        { label: "Draft", value: drafts, icon: Clock3, tone: "blue" },
        { label: "Archived", value: archived, icon: Archive, tone: "amber" },
      ]} />
      <form method="get" role="search" className="flex min-w-0 gap-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <span className="sr-only">Search lessons</span>
          <input name="q" defaultValue={query} placeholder="Search lesson title, series, or category..." className="min-h-10 w-full rounded-lg border border-stone-200 bg-white ps-10 pe-4 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100" />
        </label>
        <button type="submit" aria-label="Search lessons" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800">
          <Search className="size-4 sm:hidden" aria-hidden="true" /><span className="hidden sm:inline">Search</span>
        </button>
      </form>

      <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900 lg:block">
        <div className="overflow-x-auto"><table className="w-full min-w-225 text-left text-xs">
          <thead className="bg-stone-50 dark:bg-stone-950/50"><tr className="border-b border-stone-200 dark:border-stone-800">{["#", "Title", "Series", "Category", "Duration", "Status", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {lessons.map((lesson) => <tr key={lesson.id} className="transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-800/30">
              <td className="px-4 py-4 font-mono text-sm text-stone-500">{lesson.lessonNumber ?? "—"}</td>
              <td className="max-w-80 px-4 py-4"><p className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100" title={lesson.title}>{lesson.title}</p><p className="mt-1 truncate text-xs text-stone-500">{lesson.slug}</p></td>
              <td className="max-w-44 truncate px-4 py-4 text-sm text-stone-600 dark:text-stone-300">{lesson.series?.title ?? "—"}</td>
              <td className="px-4 py-4 text-sm text-stone-600 dark:text-stone-300">{lesson.category?.name ?? "—"}</td>
              <td className="px-4 py-4 font-mono text-sm text-stone-600 dark:text-stone-300">{lesson.duration ? `${Math.floor(lesson.duration / 60)}m` : "—"}</td>
              <td className="px-4 py-4"><LessonStatus status={lesson.status} /></td>
              <td className="px-4 py-3"><LessonActions lesson={lesson} /></td>
            </tr>)}
            {lessons.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-xs text-stone-500">{query ? "No lessons match your search." : "No lessons yet."}</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="space-y-3 lg:hidden">
        {lessons.map((lesson) => <article key={lesson.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="line-clamp-2 text-base font-semibold text-stone-800 dark:text-stone-100">{lesson.title}</p><p className="mt-1 truncate font-mono text-xs text-stone-500">{lesson.lessonNumber ? `#${lesson.lessonNumber} · ` : ""}{lesson.slug}</p></div><LessonStatus status={lesson.status} /></div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-sm text-stone-600 dark:text-stone-400"><span>{lesson.series?.title ?? "No series"}</span><span>{lesson.category?.name ?? "Uncategorized"}</span><span>{lesson.duration ? `${Math.floor(lesson.duration / 60)} min` : "No duration"}</span></div>
          <div className="mt-4 flex justify-end border-t border-stone-100 pt-3 dark:border-stone-800"><LessonActions lesson={lesson} /></div>
        </article>)}
        {lessons.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500 dark:border-stone-700">{query ? "No lessons match your search." : "No lessons yet."}</p>}
      </div>
    </div>
  );
}

function LessonStatus({ status }: { status: string }) {
  const className = status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : status === "ARCHIVED" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" : "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200";
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status === "PUBLISHED" ? "Published" : status === "ARCHIVED" ? "Archived" : "Draft"}</span>;
}
