import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Eye } from "lucide-react";
import { createSeries, deleteSeries, toggleSeriesVisibility } from "@/server/admin/actions";
import { CreateDialog } from "@/components/admin/CreateDialog";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { EditSeriesButton } from "@/components/admin/EditSeriesButton";
import { ToggleVisibilityButton } from "@/components/admin/ToggleVisibilityButton";

export default async function AdminSeriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const [seriesList, categories, books] = await Promise.all([
    prisma.series.findMany({ orderBy: { order: "asc" }, include: { category: { select: { name: true } }, _count: { select: { lessons: true } } } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.book.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("series")}</h1>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{seriesList.length} series in the catalog</p>
        </div>
        <CreateDialog title="Add Series" submitLabel="Create series" action={createSeries}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <F name="slug" label="Slug" required />
            <F name="title" label="English Title" required />
            <F name="arTitle" label="Arabic Title" />
            <F name="amTitle" label="Amharic Title" />
            <F name="order" label="Display Order" />
            <div>
              <label htmlFor="new-series-status" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Status</label>
              <select id="new-series-status" name="status" className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-series-category" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Category</label>
              <select id="new-series-category" name="categoryId" className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="new-series-book" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Linked Book</label>
              <select id="new-series-book" name="bookId" className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">
                <option value="">— None —</option>
                {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </div>
          </div>
        </CreateDialog>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[320px] table-fixed text-xs sm:min-w-[560px] lg:min-w-[900px]">
          <thead className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800">
            <tr>{["Order", "Title", "Category", "Lessons", "Status", "Actions"].map((h) => <th key={h} className={`px-2 py-3 text-start font-semibold text-stone-600 dark:text-stone-400 sm:px-4 ${h === "Order" ? "hidden sm:table-cell" : ["Category", "Lessons"].includes(h) ? "hidden lg:table-cell" : h === "Actions" ? "w-[112px] sm:w-auto" : h === "Status" ? "w-[64px] sm:w-auto" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {seriesList.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-stone-400">No series yet.</td></tr> : seriesList.map((s) => (
              <tr key={s.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                <td className="hidden px-4 py-3 font-mono text-stone-400 sm:table-cell">{s.order}</td>
                <td className="max-w-[180px] truncate px-2 py-3 font-medium text-stone-800 dark:text-stone-200 sm:px-4">{s.title}</td>
                <td className="hidden px-4 py-3 text-stone-500 lg:table-cell">{s.category?.name ?? "—"}</td>
                <td className="hidden px-4 py-3 text-stone-500 lg:table-cell">{(s._count as { lessons: number }).lessons}</td>
                <td className="w-[64px] px-2 py-3 sm:w-auto sm:px-4">
                  <ToggleVisibilityButton
                    id={s.id}
                    currentStatus={s.status}
                    itemName={s.title}
                    action={toggleSeriesVisibility}
                    compact
                  />
                </td>
                <td className="w-[112px] px-2 py-3 sm:w-auto sm:px-4">
                  <div className="flex min-w-0 items-center justify-end gap-0 sm:justify-start sm:gap-2">
                  <Link href={`/series/${s.slug}`} aria-label={`View ${s.title}`} title={`View ${s.title}`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-blue-200 text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40">
                    <Eye className="size-4" aria-hidden="true" />
                  </Link>
                  <EditSeriesButton
                    series={{
                      id: s.id,
                      slug: s.slug,
                      title: s.title,
                      translations: (s.translations as Record<string, string>) ?? {},
                      description: s.description ?? null,
                      descTranslations: (s.descTranslations as Record<string, string>) ?? {},
                      order: s.order,
                      status: s.status,
                      categoryId: s.categoryId ?? null,
                      bookId: s.bookId ?? null,
                    }}
                    categories={categories}
                    books={books}
                    compact
                  />
                  <DeleteButton action={deleteSeries.bind(null, s.id)} label="Delete" itemName={s.title} itemType="series" compact />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function F({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{label}{required && " *"}</label>
      <input id={name} name={name} required={required} className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700" />
    </div>
  );
}
