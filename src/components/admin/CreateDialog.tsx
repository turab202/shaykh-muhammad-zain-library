"use client";

import { useId, useRef, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import { Plus, X } from "lucide-react";

interface CreateDialogProps {
  title: string;
  submitLabel: string;
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  triggerClassName?: string;
}

export function CreateDialog({ title, submitLabel, action, children, triggerClassName }: CreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  function openDialog() {
    setError(null);
    setOpen(true);
    requestAnimationFrame(() => dialogRef.current?.showModal());
  }

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await action(formData);
        closeDialog();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Unable to save this item.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={triggerClassName ?? "inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {title}
      </button>

      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === dialogRef.current) closeDialog();
          }}
          className="fixed inset-0 m-auto flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
            <h2 id={titleId} className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Close dialog"
              className="inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {children}
              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-4 dark:border-stone-800 dark:bg-stone-900/50">
              <button
                type="button"
                onClick={closeDialog}
                disabled={isPending}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-60 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {isPending ? "Saving…" : submitLabel}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}