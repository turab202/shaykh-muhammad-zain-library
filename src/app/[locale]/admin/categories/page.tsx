import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createCategory, deleteCategory } from "@/server/admin/actions";
import { CreateDialog } from "@/components/admin/CreateDialog";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { EditCategoryButton } from "@/components/admin/EditCategoryButton";
import { AdminPageHeading, AdminSummaryGrid } from "@/components/admin/AdminPageChrome";
import { Layers, BookOpen, FileText, Search } from "lucide-react";

export default async function AdminCategoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });
  const query = (await searchParams).q?.trim() ?? "";

  const [categories, categoryCount, lessonCount, seriesCount, bookCount] = await Promise.all([
    prisma.category.findMany({
      where: query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } }] } : undefined,
      orderBy: { name: "asc" },
      include: { _count: { select: { lessons: true, series: true, books: true } } },
    }),
    prisma.category.count(),
    prisma.lesson.count({ where: { categoryId: { not: null } } }),
    prisma.series.count({ where: { categoryId: { not: null } } }),
    prisma.book.count({ where: { categoryId: { not: null } } }),
  ]);

  return (
    <div className="mx-auto max-w-360 space-y-4">
      <AdminPageHeading title={t("categories")} description={`Organize lessons, series, and books · ${categoryCount} categories`} icon={Layers}
        action={
          <CreateDialog title="Add Category" submitLabel="Create category" action={createCategory} triggerClassName="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 sm:w-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field name="slug" label="Slug (e.g. hadith)" required />
            <Field name="name" label="English Name" required />
            <Field name="arName" label="Arabic Name (اسم)" />
            <Field name="amName" label="Amharic Name" />
            <Field name="icon" label="Lucide Icon Name (e.g. BookOpen)" />
            <Field name="colorClass" label="Tailwind Color Class" />
          </div>
          <FieldTextarea name="description" label="English Description" />
          <FieldTextarea name="arDescription" label="Arabic Description" />
          </CreateDialog>
        }
      />

      <AdminSummaryGrid items={[
        { label: "Categories", value: categoryCount, icon: Layers },
        { label: "Lessons assigned", value: lessonCount, icon: FileText, tone: "blue" },
        { label: "Series assigned", value: seriesCount, icon: Layers, tone: "amber" },
        { label: "Books assigned", value: bookCount, icon: BookOpen, tone: "green" },
      ]} />

      <form method="get" role="search" className="flex min-w-0 gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <span className="sr-only">Search categories</span>
          <input name="q" defaultValue={query} placeholder="Search category name or slug..." className="min-h-11 w-full rounded-md border border-stone-200 bg-white ps-9 pe-3 text-xs text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100" />
        </label>
        <button aria-label="Search categories" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800">
          <Search className="size-4 sm:hidden" aria-hidden="true" /><span className="hidden sm:inline">Search</span>
        </button>
      </form>

      <div className="hidden overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-950/50"><tr className="border-b border-stone-200 dark:border-stone-800">
              {(["Slug", "Name", "Lessons", "Series", "Books", "Actions"]).map((heading) => <th key={heading} className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wide text-stone-500">{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {categories.map((category) => <tr key={category.id} className="transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-800/30">
                <td className="px-3 py-3 font-mono text-[10px] text-stone-500">{category.slug}</td>
                <td className="px-3 py-3 text-[11px] font-semibold text-stone-800 dark:text-stone-100">{category.name}</td>
                <td className="px-3 py-3 text-[10px] tabular-nums text-stone-600 dark:text-stone-300">{category._count.lessons}</td>
                <td className="px-3 py-3 text-[10px] tabular-nums text-stone-600 dark:text-stone-300">{category._count.series}</td>
                <td className="px-3 py-3 text-[10px] tabular-nums text-stone-600 dark:text-stone-300">{category._count.books}</td>
                <td className="px-3 py-2"><CategoryActions category={category} /></td>
              </tr>)}
              {categories.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-stone-500">{query ? "No categories match your search." : "No categories yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2.5 lg:hidden">
        {categories.map((category) => <article key={category.id} className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-xs font-semibold text-stone-800 dark:text-stone-100">{category.name}</h2><p className="mt-1 truncate font-mono text-[10px] text-stone-500">{category.slug}</p></div><CategoryActions category={category} mobile /></div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-stone-100 pt-2.5 dark:border-stone-800"><MiniCount label="Lessons" value={category._count.lessons} /><MiniCount label="Series" value={category._count.series} /><MiniCount label="Books" value={category._count.books} /></div>
        </article>)}
        {categories.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500 dark:border-stone-700">{query ? "No categories match your search." : "No categories yet."}</p>}
      </div>
    </div>
  );
}

function CategoryActions({ category, mobile = false }: { category: { id: string; slug: string; name: string; translations: unknown; description: string | null; descTranslations: unknown; icon: string | null; colorClass: string | null }; mobile?: boolean }) {
  return <div className={`flex items-center gap-1.5 ${mobile ? "[&_button]:min-h-11" : ""}`}><EditCategoryButton category={{ ...category, translations: category.translations as Record<string, string>, descTranslations: category.descTranslations as Record<string, string> }} compact={!mobile} /><DeleteButton action={deleteCategory.bind(null, category.id)} itemName={category.name} itemType="category" compact={!mobile} /></div>;
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return <div><p className="text-[9px] text-stone-500">{label}</p><p className="mt-0.5 text-xs font-semibold tabular-nums text-stone-800 dark:text-stone-200">{value}</p></div>;
}

function Field({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{label}{required && " *"}</label>
      <input id={name} name={name} required={required} className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700" />
    </div>
  );
}

function FieldTextarea({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{label}</label>
      <textarea id={name} name={name} rows={2} className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700 resize-none" />
    </div>
  );
}
