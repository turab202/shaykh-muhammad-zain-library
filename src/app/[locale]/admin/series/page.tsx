import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createSeries, deleteSeries, toggleSeriesVisibility } from "@/server/admin/actions";
import { CreateDialog } from "@/components/admin/CreateDialog";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { EditSeriesButton } from "@/components/admin/EditSeriesButton";
import { UploadSeriesCoverButton } from "@/components/admin/UploadSeriesCoverButton";
import { ToggleVisibilityButton } from "@/components/admin/ToggleVisibilityButton";
import { AdminPageHeading, AdminSummaryGrid } from "@/components/admin/AdminPageChrome";
import { storageKeyToUrl } from "@/lib/media-url";
import { Layers, BookOpen, Eye, Clock3, Search } from "lucide-react";

export default async function AdminSeriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });
  const query = (await searchParams).q?.trim() ?? "";

  const [seriesList, categories, books, total, published, drafts, linkedBooks] = await Promise.all([
    prisma.series.findMany({ where: query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } }] } : undefined, orderBy: { order: "asc" }, include: { category: { select: { name: true } }, _count: { select: { lessons: true } } } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.book.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.series.count(),
    prisma.series.count({ where: { status: "PUBLISHED" } }),
    prisma.series.count({ where: { status: "DRAFT" } }),
    prisma.series.count({ where: { bookId: { not: null } } }),
  ]);

  return (
    <div className="mx-auto max-w-360 space-y-6">
      <AdminPageHeading title={t("series")} description={`Organize lessons into collections · ${total} series`} icon={Layers}
        action={
          <CreateDialog title="Add Series" submitLabel="Create series" action={createSeries} triggerClassName="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 sm:w-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <F name="slug" label="Slug" required />
            <F name="title" label="English Title" required />
            <F name="arTitle" label="Arabic Title" />
            <F name="amTitle" label="Amharic Title" />
            <F name="order" label="Display Order" />
            <div>
              <label htmlFor="new-series-status" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">Status</label>
              <select id="new-series-status" name="status" className="min-h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-series-category" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">Category</label>
              <select id="new-series-category" name="categoryId" className="min-h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="new-series-book" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">Linked Book</label>
              <select id="new-series-book" name="bookId" className="min-h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">
                <option value="">— None —</option>
                {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </div>
          </div>
          </CreateDialog>
        }
      />

      <AdminSummaryGrid items={[
        { label: "Total series", value: total, icon: Layers },
        { label: "Published", value: published, icon: Eye },
        { label: "Draft", value: drafts, icon: Clock3, tone: "blue" },
        { label: "Linked to a book", value: linkedBooks, icon: BookOpen, tone: "amber" },
      ]} />

      <form method="get" role="search" className="flex min-w-0 gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <span className="sr-only">Search series</span>
          <input name="q" defaultValue={query} placeholder="Search series title or slug..." className="min-h-10 w-full rounded-lg border border-stone-200 bg-white ps-10 pe-4 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100" />
        </label>
        <button type="submit" aria-label="Search series" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800">
          <Search className="size-4 sm:hidden" aria-hidden="true" /><span className="hidden sm:inline">Search</span>
        </button>
      </form>

      <div className="hidden overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 lg:block">
        <div className="overflow-x-auto"><table className="w-full min-w-200 text-left text-xs">
          <thead className="bg-stone-50 dark:bg-stone-950/50"><tr className="border-b border-stone-200 dark:border-stone-800">{["Order", "Title", "Category", "Lessons", "Status", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {seriesList.map((item) => <tr key={item.id} className="transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-800/30">
              <td className="px-4 py-4 font-mono text-sm text-stone-500">{item.order}</td>
              <td className="max-w-72 px-4 py-4"><p className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100" title={item.title}>{item.title}</p><p className="mt-1 truncate font-mono text-xs text-stone-500">{item.slug}</p></td>
              <td className="px-4 py-4 text-sm text-stone-600 dark:text-stone-300">{item.category?.name ?? "—"}</td>
              <td className="px-4 py-4 text-sm tabular-nums text-stone-600 dark:text-stone-300">{item._count.lessons}</td>
              <td className="px-4 py-4"><SeriesStatus status={item.status} /></td>
              <td className="px-4 py-3"><SeriesActions item={item} categories={categories} books={books} /></td>
            </tr>)}
            {seriesList.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-stone-500">{query ? "No series match your search." : "No series yet."}</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="space-y-3 lg:hidden">
        {seriesList.map((item) => <article key={item.id} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-semibold text-stone-800 dark:text-stone-100">{item.title}</p><p className="mt-1 truncate font-mono text-xs text-stone-500">{item.slug} · order {item.order}</p></div><SeriesActions item={item} categories={categories} books={books} /></div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3 dark:border-stone-800"><span className="text-sm text-stone-600 dark:text-stone-400">{item.category?.name ?? "Uncategorized"}</span><span className="text-sm text-stone-600 dark:text-stone-400">{item._count.lessons} lessons</span><SeriesStatus status={item.status} /></div>
        </article>)}
        {seriesList.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500 dark:border-stone-700">{query ? "No series match your search." : "No series yet."}</p>}
      </div>
    </div>
  );
}

function SeriesStatus({ status }: { status: string }) {
  const styles = status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : status === "ARCHIVED" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200" : "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{status === "ARCHIVED" ? "Hidden" : status === "PUBLISHED" ? "Published" : "Draft"}</span>;
}

function SeriesActions({ item, categories, books }: { item: { id: string; slug: string; title: string; translations: unknown; description: string | null; descTranslations: unknown; order: number; status: string; categoryId: string | null; bookId: string | null; coverImageKey: string | null }; categories: { id: string; name: string }[]; books: { id: string; title: string }[] }) {
  return <div className="flex flex-wrap items-center gap-1.5">
    <UploadSeriesCoverButton seriesId={item.id} seriesSlug={item.slug} hasCover={!!item.coverImageKey} currentCoverUrl={storageKeyToUrl(item.coverImageKey)} thumbnailSize="table" />
    <ToggleVisibilityButton id={item.id} currentStatus={item.status} itemName={item.title} action={toggleSeriesVisibility} />
    <Link href={`/series/${item.slug}`} className="inline-flex min-h-9 items-center rounded-md border border-stone-200 px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">View</Link>
    <EditSeriesButton series={{ ...item, translations: item.translations as Record<string, string>, descTranslations: item.descTranslations as Record<string, string> }} categories={categories} books={books} />
    <DeleteButton action={deleteSeries.bind(null, item.id)} itemName={item.title} itemType="series" />
  </div>;
}

function F({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">{label}{required && " *"}</label>
      <input id={name} name={name} required={required} className="min-h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100" />
    </div>
  );
}
