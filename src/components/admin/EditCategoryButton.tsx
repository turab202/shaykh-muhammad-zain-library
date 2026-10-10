"use client";

/**
 * EditCategoryButton — opens a pre-filled modal form to update a category.
 * Mirrors the pattern of DeleteButton using the native <dialog> element.
 */

import { useState, useRef, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";
import { updateCategory } from "@/server/admin/actions";

interface CategoryData {
  id: string;
  slug: string;
  name: string;
  translations: Record<string, string>;
  description: string | null;
  descTranslations: Record<string, string>;
  icon: string | null;
  colorClass: string | null;
}

interface EditCategoryButtonProps {
  category: CategoryData;
}

export function EditCategoryButton({ category }: EditCategoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
        await updateCategory(category.id, formData);
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
        className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer text-xs mr-2"
      >
        Edit
      </button>

      {open && (
        <dialog
          ref={dialogRef}
          onClose={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === dialogRef.current) closeModal();
          }}
          className="fixed inset-0 m-auto w-full max-w-lg rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Pencil className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">Edit Category</span>
            </div>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close dialog"
              className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ModalField name="slug" label="Slug *" defaultValue={category.slug} required />
                <ModalField name="name" label="English Name *" defaultValue={category.name} required />
                <ModalField name="arName" label="Arabic Name" defaultValue={category.translations?.ar ?? ""} />
                <ModalField name="amName" label="Amharic Name" defaultValue={category.translations?.am ?? ""} />
                <ModalField name="icon" label="Icon (e.g. BookOpen)" defaultValue={category.icon ?? ""} />
                <ModalField name="colorClass" label="Tailwind Color Class" defaultValue={category.colorClass ?? ""} />
              </div>
              <ModalTextarea name="description" label="English Description" defaultValue={category.description ?? ""} />
              <ModalTextarea name="arDescription" label="Arabic Description" defaultValue={category.descTranslations?.ar ?? ""} />

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" aria-hidden="true" /> Saved successfully!
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 rounded-b-xl">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
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

function ModalField({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={`edit-${name}`}
        className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1"
      >
        {label}
      </label>
      <input
        id={`edit-${name}`}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700"
      />
    </div>
  );
}

function ModalTextarea({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`edit-${name}`}
        className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1"
      >
        {label}
      </label>
      <textarea
        id={`edit-${name}`}
        name={name}
        defaultValue={defaultValue}
        rows={2}
        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700 resize-none"
      />
    </div>
  );
}


