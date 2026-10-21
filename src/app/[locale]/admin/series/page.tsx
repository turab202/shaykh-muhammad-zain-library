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
import { Layers, BookOpen, Eye, Clock3, Search, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

const pageSize = 8;

export default async function AdminSeriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });
  const paramsValue = await searchParams;
  const query = paramsValue.q?.trim() ?? "";
  const status = isSeriesStatus(paramsValue.status) ? paramsValue.status : "all";
  const requestedPage = Math.max(1, Number.parseInt(paramsValue.page ?? "1", 10) || 1);
  const where = {
    ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" as const } }, { slug: { contains: query, mode: "insensitive" as const } }] } : {}),
    ...(status !== "all" ? { status } : {}),
  };

  const [categories, books, total, published, drafts, linkedBooks, filteredTotal] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.book.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.series.count(),
    prisma.series.count({ where: { status: "PUBLISHED" } }),
    prisma.series.count({ where: { status: "DRAFT" } }),
    prisma.series.count({ where: { bookId: { not: null } } }),
    prisma.series.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const currentPage = Math.min(requestedPage, pageCount);
  const seriesList = await prisma.series.findMany({
    where,
    orderBy: { order: "asc" },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    include: { category: { select: { name: true } }, _count: { select: { lessons: true } } },
  });
  const rangeStart = filteredTotal ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(currentPage * pageSize, filteredTotal);

  return (
    <div className="mx-auto min-w-0 max-w-360 space-y-5 sm:space-y-6">
      <AdminPageHeading title={t("series")} description={`Organize lessons into collections · ${total} series`} icon={Layers}
        action={
          <CreateDialog title="Add Series" submitLabel="Create series" action={createSeries} triggerClassName="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 sm:w-auto">
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

      <form method="get" role="search" className="flex min-w-0 flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <span className="sr-only">Search series</span>
          <input name="q" defaultValue={query} placeholder="Search series title or slug..." className="min-h-10 w-full rounded-lg border border-stone-200 bg-white ps-10 pe-4 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100" />
        </label>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1 sm:w-36 sm:flex-none">
            <span className="sr-only">Filter by status</span>
            <select name="status" defaultValue={status} className="min-h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200">
              <option value="all">All series</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Hidden</option>
            </select>
          </label>
          <button type="submit" aria-label="Search series" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 dark:hover:bg-stone-800">
            <Search className="size-4 sm:hidden" aria-hidden="true" /><span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </form>

      <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900 xl:block">
        <div className="overflow-x-auto"><table className="w-full min-w-220 text-left text-xs">
          <thead className="bg-stone-50/80 dark:bg-stone-950/50"><tr className="border-b border-stone-200 dark:border-stone-800">
            {["#", "Image", "Title", "Category", "Lessons", "Status", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">{heading}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {seriesList.map((item, index) => <tr key={item.id} className="transition-colors hover:bg-stone-50/70 dark:hover:bg-stone-800/30">
              <td className="w-12 px-4 py-3 text-sm tabular-nums text-stone-500 dark:text-stone-400">{rangeStart + index}</td>
              <td className="w-20 px-4 py-3"><UploadSeriesCoverButton seriesId={item.id} seriesSlug={item.slug} hasCover={!!item.coverImageKey} currentCoverUrl={storageKeyToUrl(item.coverImageKey)} thumbnailSize="table" /></td>
              <td className="max-w-80 px-4 py-3"><p className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100" title={item.title}>{item.title}</p><p className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{item.slug}</p></td>
              <td className="px-4 py-3 text-sm text-stone-600 dark:text-stone-300">{item.category?.name ?? "—"}</td>
              <td className="px-4 py-3 text-sm tabular-nums text-stone-600 dark:text-stone-300">{item._count.lessons}</td>
              <td className="px-4 py-3"><SeriesStatus status={item.status} /></td>
              <td className="px-4 py-3 text-end"><SeriesActions item={item} categories={categories} books={books} /></td>
            </tr>)}
            {seriesList.length === 0 && <tr><td colSpan={7} className="px-4 py-14 text-center">
              <Layers className="mx-auto size-8 text-stone-300 dark:text-stone-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-stone-700 dark:text-stone-200">{query || status !== "all" ? "No series match these filters." : "No series yet."}</p>
              <p className="mt-1 text-xs text-stone-500">Try another search or add a series to get started.</p>
            </td></tr>}
          </tbody>
        </table></div>
        <SeriesPagination query={query} status={status} page={currentPage} pages={pageCount} start={rangeStart} end={rangeEnd} total={filteredTotal} />
      </div>

      <div className="space-y-3 xl:hidden">
        {seriesList.map((item) => <article key={item.id} className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-4">
          <div className="flex items-center gap-3">
            <UploadSeriesCoverButton seriesId={item.id} seriesSlug={item.slug} hasCover={!!item.coverImageKey} currentCoverUrl={storageKeyToUrl(item.coverImageKey)} thumbnailSize="table" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{item.title}</h2>
              <p className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{item.slug}</p>
              <div className="mt-2"><SeriesStatus status={item.status} /></div>
            </div>
            <SeriesActions item={item} categories={categories} books={books} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3 text-xs dark:border-stone-800">
            <span className="truncate text-stone-600 dark:text-stone-300">{item.category?.name ?? "Uncategorized"}</span>
            <span className="shrink-0 tabular-nums text-stone-500 dark:text-stone-400">{item._count.lessons} lessons</span>
          </div>
        </article>)}
        {seriesList.length === 0 && <div className="rounded-xl border border-dashed border-stone-300 bg-white px-5 py-12 text-center dark:border-stone-700 dark:bg-stone-900">
          <Layers className="mx-auto size-8 text-stone-300 dark:text-stone-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-stone-700 dark:text-stone-200">{query || status !== "all" ? "No series match these filters." : "No series yet."}</p>
          <p className="mt-1 text-xs text-stone-500">Try another search or add a series to get started.</p>
        </div>}
        <SeriesPagination query={query} status={status} page={currentPage} pages={pageCount} start={rangeStart} end={rangeEnd} total={filteredTotal} mobile />
      </div>
    </div>
  );
}

function SeriesStatus({ status }: { status: string }) {
  const styles = status === "PUBLISHED"
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
    : status === "ARCHIVED"
      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
      : "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200";
  const dot = status === "PUBLISHED" ? "bg-emerald-600" : status === "ARCHIVED" ? "bg-rose-600" : "bg-sky-600";
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles}`}><span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />{status === "ARCHIVED" ? "Hidden" : status === "PUBLISHED" ? "Published" : "Draft"}</span>;
}

function SeriesActions({ item, categories, books }: { item: { id: string; slug: string; title: string; translations: unknown; description: string | null; descTranslations: unknown; order: number; status: string; categoryId: string | null; bookId: string | null; coverImageKey: string | null }; categories: { id: string; name: string }[]; books: { id: string; title: string }[] }) {
  return (
    <details className="group relative">
      <summary aria-label={`Actions for ${item.title}`} title="Series actions" className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 group-open:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800 dark:group-open:bg-stone-800">
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </summary>
      <div className="absolute end-0 top-full z-20 mt-1 flex min-w-44 flex-col gap-1 rounded-lg border border-stone-200 bg-white p-1.5 shadow-lg dark:border-stone-700 dark:bg-stone-900">
        <UploadSeriesCoverButton seriesId={item.id} seriesSlug={item.slug} hasCover={!!item.coverImageKey} currentCoverUrl={storageKeyToUrl(item.coverImageKey)} />
        <ToggleVisibilityButton id={item.id} currentStatus={item.status} itemName={item.title} action={toggleSeriesVisibility} />
        <Link href={`/series/${item.slug}`} className="inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800">View series</Link>
        <EditSeriesButton series={{ ...item, translations: item.translations as Record<string, string>, descTranslations: item.descTranslations as Record<string, string> }} categories={categories} books={books} />
        <DeleteButton action={deleteSeries.bind(null, item.id)} itemName={item.title} itemType="series" />
      </div>
    </details>
  );
}

function SeriesPagination({ query, status, page, pages, start, end, total, mobile = false }: { query: string; status: string; page: number; pages: number; start: number; end: number; total: number; mobile?: boolean }) {
  const pageNumbers = getPageNumbers(page, pages);
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status !== "all") params.set("status", status);
    params.set("page", String(nextPage));
    return `/admin/series?${params.toString()}`;
  };
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 dark:border-stone-800 ${mobile ? "rounded-xl border bg-white shadow-sm dark:bg-stone-900 xl:hidden" : ""}`}>
      <p className="text-xs text-stone-500 dark:text-stone-400">{total ? `Showing ${start}–${end} of ${total} series` : "No series to show"}</p>
      <nav aria-label="Series pages" className="flex items-center gap-1">
        <PageLink href={pageHref(Math.max(1, page - 1))} label="Previous page" disabled={page <= 1}><ChevronLeft className="size-4" aria-hidden="true" /></PageLink>
        {pageNumbers[0] > 1 && <span aria-hidden="true" className="px-1 text-xs text-stone-400">…</span>}
        {pageNumbers.map((number) => <Link key={number} href={pageHref(number)} aria-current={number === page ? "page" : undefined} className={`inline-flex size-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${number === page ? "bg-emerald-800 text-white shadow-sm" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"}`}>{number}</Link>)}
        {pageNumbers[pageNumbers.length - 1] < pages && <span aria-hidden="true" className="px-1 text-xs text-stone-400">…</span>}
        <PageLink href={pageHref(Math.min(pages, page + 1))} label="Next page" disabled={page >= pages}><ChevronRight className="size-4" aria-hidden="true" /></PageLink>
      </nav>
    </div>
  );
}

function PageLink({ href, label, disabled, children }: { href: string; label: string; disabled: boolean; children: React.ReactNode }) {
  return disabled
    ? <span aria-disabled="true" aria-label={label} className="inline-flex size-9 items-center justify-center rounded-lg border border-stone-200 text-stone-300 dark:border-stone-700 dark:text-stone-600">{children}</span>
    : <Link href={href} aria-label={label} className="inline-flex size-9 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">{children}</Link>;
}

function getPageNumbers(current: number, pages: number) {
  if (pages <= 5) return Array.from({ length: pages }, (_, index) => index + 1);
  const first = Math.max(1, Math.min(current - 2, pages - 4));
  return Array.from({ length: 5 }, (_, index) => first + index);
}

function isSeriesStatus(status: string | undefined): status is "PUBLISHED" | "DRAFT" | "ARCHIVED" {
  return status === "PUBLISHED" || status === "DRAFT" || status === "ARCHIVED";
}

function F({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">{label}{required && " *"}</label>
      <input id={name} name={name} required={required} className="min-h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100" />
    </div>
  );
}
