"use client";

/**
 * DeleteButton — replaces the native browser confirm() dialog with a
 * styled modal. Wraps a Server Action form submission.
 *
 * Usage:
 *   <DeleteButton action={deleteLesson.bind(null, l.id)} label="Del" itemName={l.title} />
 */

import { useState, useRef, useTransition } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { adminActionDangerClass } from "./AdminActionMenu";

interface DeleteButtonProps {
  /** The bound server action to call on confirm */
  action: () => Promise<void>;
  /** Short button label, e.g. "Del" or "Delete" */
  label?: string;
  /** Name shown in the modal body, e.g. the item's title */
  itemName: string;
  /** Optional item type shown in modal heading, e.g. "series", "lesson" */
  itemType?: string;
  compact?: boolean;
  menu?: boolean;
}

export function DeleteButton({
  action,
  label = "Delete",
  itemName,
  itemType = "item",
  compact = false,
  menu = false,
}: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openModal() {
    setError("");
    setOpen(true);
    // Use requestAnimationFrame so the element is rendered before we call showModal
    requestAnimationFrame(() => dialogRef.current?.showModal());
  }

  function closeModal() {
    dialogRef.current?.close();
    setOpen(false);
  }

  function handleConfirm() {
    startTransition(async () => {
      setError("");
      try {
        await action();
        closeModal();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to delete this item.");
      }
    });
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openModal}
        aria-label={`Delete ${itemType}: ${itemName}`}
        title={`Delete ${itemType}: ${itemName}`}
        className={menu
          ? adminActionDangerClass
          : compact
          ? "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          : "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"}
      >
        {(compact || menu) && <Trash2 className="size-4" aria-hidden="true" />}
        {menu ? `Delete ${itemType}` : !compact && label}
      </button>

      {/* Modal — only mounted when open to avoid stale refs */}
      {open && (
        <dialog
          ref={dialogRef}
          onClose={() => setOpen(false)}
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === dialogRef.current) closeModal();
          }}
          className="fixed inset-0 m-auto w-full max-w-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">Delete {itemType}</span>
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

          {/* Body */}
          <div className="px-5 py-5 space-y-3">
            <p className="text-sm text-stone-700 dark:text-stone-300">
              Are you sure you want to delete this {itemType}?
            </p>
            <p className="text-xs font-medium text-stone-900 dark:text-stone-100 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 break-words">
              {itemName}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              This action cannot be undone.
            </p>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 rounded-b-xl">
            <button
              type="button"
              onClick={closeModal}
              disabled={isPending}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-stone-300 px-3.5 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-red-600 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              {isPending ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
