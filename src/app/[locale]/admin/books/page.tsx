import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createBook, deleteBook } from "@/server/admin/actions";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { EditBookButton } from "@/components/admin/EditBookButton";

export default async function AdminBooksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect("/login"); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const [books, categories] = await Promise.all([
    prisma.book.findMany({ orderBy: { title: "asc" }, include: { category: { select: { name: true } }, _count: { select: { lessons: true } } } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("books")}</h1>

      <form action={createBook} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Add Book</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F name="slug" label="Slug" required />
          <F name="title" label="English Title" required />
          <F name="arTitle" label="Arabic Title" />
          <F name="amTitle" label="Amharic Title" />
          <F name="author" label="Author (English)" />
          <F name="arAuthor" label="Author (Arabic)" />
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Category</label>
            <select name="categoryId" className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none">
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Status</label>
            <select name="status" className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
        </div>
        <button type="submit" className="px-4 py-2 bg-emerald-900 text-amber-100 rounded-lg text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer">Create Book</button>
      </form>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800">
            <tr>{["Title", "Author", "Category", "Lessons", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3 text-start font-semibold text-stone-600 dark:text-stone-400">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {books.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-stone-400">No books yet.</td></tr> : books.map((b) => (
              <tr key={b.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                <td className="px-4 py-3 font-medium text-stone-800 dark:text-stone-200 max-w-[180px] truncate">{b.title}</td>
                <td className="px-4 py-3 text-stone-500 italic max-w-[140px] truncate">{b.author ?? "—"}</td>
                <td className="px-4 py-3 text-stone-500">{b.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-stone-500">{(b._count as { lessons: number }).lessons}</td>
                <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${b.status === "PUBLISHED" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-stone-100 dark:bg-stone-800 text-stone-500"}`}>{b.status}</span></td>
                <td className="px-4 py-3 flex items-center gap-2">
                  <Link href={`/kutub/${b.slug}`} className="text-blue-600 hover:underline">View</Link>
                  <EditBookButton
                    book={{
                      id: b.id,
                      slug: b.slug,
                      title: b.title,
                      translations: (b.translations as Record<string, string>) ?? {},
                      author: b.author ?? null,
                      authorTranslations: (b.authorTranslations as Record<string, string>) ?? {},
                      description: b.description ?? null,
                      descTranslations: (b.descTranslations as Record<string, string>) ?? {},
                      status: b.status,
                      categoryId: b.categoryId ?? null,
                    }}
                    categories={categories}
                  />
                  <DeleteButton action={deleteBook.bind(null, b.id)} label="Del" itemName={b.title} itemType="book" />
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
