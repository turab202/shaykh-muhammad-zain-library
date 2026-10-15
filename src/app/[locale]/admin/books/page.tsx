import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Eye } from "lucide-react";
import { createBook, deleteBook, toggleBookVisibility } from "@/server/admin/actions";
import { CreateDialog } from "@/components/admin/CreateDialog";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { EditBookButton } from "@/components/admin/EditBookButton";
import { UploadPdfButton } from "@/components/admin/UploadPdfButton";
import { ToggleVisibilityButton } from "@/components/admin/ToggleVisibilityButton";
import { UploadCoverButton } from "@/components/admin/UploadCoverButton";

export default async function AdminBooksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const [books, categories] = await Promise.all([
    prisma.book.findMany({ orderBy: { title: "asc" }, include: { category: { select: { name: true } }, _count: { select: { lessons: true } }, media: { where: { mediaType: "PDF" }, select: { id: true } } } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("books")}</h1>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{books.length} books in the catalog</p>
        </div>
        <CreateDialog title="Add Book" submitLabel="Create book" action={createBook}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <F name="slug" label="Slug" required />
            <F name="title" label="English Title" required />
            <F name="arTitle" label="Arabic Title" />
            <F name="amTitle" label="Amharic Title" />
            <F name="author" label="Author (English)" />
            <F name="arAuthor" label="Author (Arabic)" />
            <div>
              <label htmlFor="new-book-category" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Category</label>
              <select id="new-book-category" name="categoryId" className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="new-book-status" className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Status</label>
              <select id="new-book-status" name="status" className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          </div>
        </CreateDialog>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[320px] table-fixed text-xs sm:min-w-[600px] lg:min-w-[900px]">
          <thead className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800">
            <tr>{["Cover", "Title", "Author", "Category", "Lessons", "Status", "Actions"].map((h) => <th key={h} className={`px-2 py-3 text-start font-semibold text-stone-600 dark:text-stone-400 sm:px-4 ${h === "Cover" ? "hidden sm:table-cell" : ["Author", "Category", "Lessons"].includes(h) ? "hidden lg:table-cell" : h === "Actions" ? "w-[176px] sm:w-auto" : h === "Status" ? "w-[64px] sm:w-auto" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {books.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-400">No books yet.</td></tr> : books.map((b) => (
              <tr key={b.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                <td className="hidden px-4 py-3 sm:table-cell">
                  <UploadCoverButton
                    bookId={b.id}
                    bookSlug={b.slug}
                    hasCover={!!b.coverImageKey}
                    currentCoverUrl={b.coverImageKey ? `/api/media/b2/${b.coverImageKey.split("/").slice(3).join("/")}` : undefined}
                  />
                </td>
                <td className="max-w-[180px] truncate px-2 py-3 font-medium text-stone-800 dark:text-stone-200 sm:px-4">{b.title}</td>
                <td className="hidden max-w-[140px] truncate px-4 py-3 text-stone-500 italic lg:table-cell">{b.author ?? "—"}</td>
                <td className="hidden px-4 py-3 text-stone-500 lg:table-cell">{b.category?.name ?? "—"}</td>
                <td className="hidden px-4 py-3 text-stone-500 lg:table-cell">{(b._count as { lessons: number }).lessons}</td>
                <td className="w-[64px] px-2 py-3 sm:w-auto sm:px-4">
                  <ToggleVisibilityButton
                    id={b.id}
                    currentStatus={b.status}
                    itemName={b.title}
                    action={toggleBookVisibility}
                    compact
                  />
                  {(b.media as {id:string}[]).length > 0 && (
                    <span className="ml-1 hidden text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 sm:inline">PDF</span>
                  )}
                </td>
                <td className="w-[176px] px-2 py-3 sm:w-auto sm:px-4">
                  <div className="flex min-w-0 items-center justify-end gap-0 sm:justify-start sm:gap-2">
                  <Link href={`/kutub/${b.slug}`} aria-label={`View ${b.title}`} title={`View ${b.title}`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-blue-200 text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40">
                    <Eye className="size-4" aria-hidden="true" />
                  </Link>
                  <UploadPdfButton
                    bookId={b.id}
                    bookTitle={b.title}
                    hasPdf={(b.media as {id:string}[]).length > 0}
                    compact
                  />
                  <UploadCoverButton
                    bookId={b.id}
                    bookSlug={b.slug}
                    hasCover={!!b.coverImageKey}
                    currentCoverUrl={b.coverImageKey ? `/api/media/b2/${b.coverImageKey.split("/").slice(3).join("/")}` : undefined}
                    compact
                  />
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
                    compact
                  />
                  <DeleteButton action={deleteBook.bind(null, b.id)} label="Delete" itemName={b.title} itemType="book" compact />
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
