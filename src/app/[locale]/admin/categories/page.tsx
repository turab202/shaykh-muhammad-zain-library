import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createCategory, deleteCategory } from "@/server/admin/actions";
import { CreateDialog } from "@/components/admin/CreateDialog";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { EditCategoryButton } from "@/components/admin/EditCategoryButton";

export default async function AdminCategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { lessons: true, series: true, books: true } } },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("categories")}</h1>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{categories.length} categories in the catalog</p>
        </div>
        <CreateDialog title="Add Category" submitLabel="Create category" action={createCategory}>
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
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[320px] table-fixed text-xs sm:min-w-[520px] lg:min-w-[760px]">
          <thead className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800">
            <tr>
              {["Slug", "Name", "Lessons", "Series", "Books", "Actions"].map((h: string) => (
                <th key={h} className={`px-2 py-3 text-start font-semibold text-stone-600 dark:text-stone-400 sm:px-4 ${h === "Slug" ? "hidden sm:table-cell" : ["Series", "Books"].includes(h) ? "hidden lg:table-cell" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {categories.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-stone-400">No categories yet.</td></tr>
            ) : categories.map((c) => (
              <tr key={c.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                <td className="hidden px-4 py-3 font-mono text-stone-500 sm:table-cell">{c.slug}</td>
                <td className="px-2 py-3 font-medium text-stone-800 dark:text-stone-200 sm:px-4">{c.name}</td>
                <td className="px-4 py-3 text-stone-500">{(c._count as { lessons: number; series: number; books: number }).lessons}</td>
                <td className="hidden px-4 py-3 text-stone-500 lg:table-cell">{(c._count as { lessons: number; series: number; books: number }).series}</td>
                <td className="hidden px-4 py-3 text-stone-500 lg:table-cell">{(c._count as { lessons: number; series: number; books: number }).books}</td>
                <td className="px-2 py-3 sm:px-4">
                  <div className="flex min-w-0 items-center justify-end gap-1 sm:justify-start sm:gap-2">
                  <EditCategoryButton category={{
                    id: c.id,
                    slug: c.slug,
                    name: c.name,
                    translations: (c.translations as Record<string, string>) ?? {},
                    description: c.description ?? null,
                    descTranslations: (c.descTranslations as Record<string, string>) ?? {},
                    icon: c.icon ?? null,
                    colorClass: c.colorClass ?? null,
                  }} compact />
                  <DeleteButton action={deleteCategory.bind(null, c.id)} label="Delete" itemName={c.name} itemType="category" compact />
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
