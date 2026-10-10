"use client";

/**
 * EditBookButton — opens a pre-filled modal form to update a book.
 * Mirrors the pattern of EditCategoryButton / EditSeriesButton.
 */

import { useState, useRef, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";
import { updateBook } from "@/server/admin/actions";

interface CategoryOption {
  id: string;
  name: string;
}

interface BookData {
  id: string;
  slug: string;
  title: string;
  translations: Record<string, string>;
  author: string | null;
  authorTranslations: Record<string, string>;
  description: string | null;
  descTranslations: Record<string, string>;
  status: string;
  categoryId: string | null;
}

interface EditBookButtonProps {
  book: BookData;
  categories: CategoryOption[];
}

export function EditBookButton({ book, categories }: EditBookButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openModal() {
    setError(null);
    setSuccess(false);
    setOpen(true);
    requestAnimationFrame(() => dialogRef.current?.showModal());
  }

  function closeModal() {
    dialogRef.current?.close();
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateBook(book.id, formData);
        setSuccess(true);
        setTimeout(() => closeModal(), 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer text-xs"
      >
        Edit
      </button>

      {open && (
        <dialog
          ref={dialogRef}
          onClose={() => setOpen(false)}
          onClick={(e) => { if (e.target === dialogRef.current) closeModal(); }}
          className="fixed inset-0 m-auto w-full max-w-lg rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Pencil className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">Edit Book</span>
            </div>
            <button type="button" onClick={closeModal} aria-label="Close dialog"
              className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MF name="slug" label="Slug *" defaultValue={book.slug} required />
                <MF name="title" label="English Title *" defaultValue={book.title} required />
                <MF name="arTitle" label="Arabic Title" defaultValue={book.translations?.ar ?? ""} />
                <MF name="amTitle" label="Amharic Title" defaultValue={book.translations?.am ?? ""} />
                <MF name="author" label="Author (English)" defaultValue={book.author ?? ""} />
                <MF name="arAuthor" label="Author (Arabic)" defaultValue={book.authorTranslations?.ar ?? ""} />

                {/* Category */}
                <div>
                  <label htmlFor="edit-book-categoryId" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Category</label>
                  <select id="edit-book-categoryId" name="categoryId" defaultValue={book.categoryId ?? ""}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700">
                    <option value="">— None —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label htmlFor="edit-book-status" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Status</label>
                  <select id="edit-book-status" name="status" defaultValue={book.status}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700">
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              <MT name="description" label="English Description" defaultValue={book.description ?? ""} />
              <MT name="arDescription" label="Arabic Description" defaultValue={book.descTranslations?.ar ?? ""} />

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
              )}
              {success && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" aria-hidden="true" /> Saved successfully!
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 rounded-b-xl">
              <button type="button" onClick={closeModal} disabled={isPending}
                className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-60">
                Cancel
              </button>
              <button type="submit" disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60">
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                {isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}

function MF({ name, label, defaultValue, required }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={`edit-book-${name}`} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{label}</label>
      <input id={`edit-book-${name}`} name={name} defaultValue={defaultValue} required={required}
        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700" />
    </div>
  );
}

function MT({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={`edit-book-${name}`} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{label}</label>
      <textarea id={`edit-book-${name}`} name={name} defaultValue={defaultValue} rows={2}
        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700 resize-none" />
    </div>
  );
}


