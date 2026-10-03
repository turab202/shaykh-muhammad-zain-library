"use client";

/**
 * EditLessonButton — opens a pre-filled modal form to update a lesson.
 * Mirrors the pattern of EditCategoryButton / EditSeriesButton / EditBookButton.
 */

import { useState, useRef, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";
import { updateLesson } from "@/server/admin/actions";

interface Option { id: string; name: string }
interface SeriesOption { id: string; title: string }
interface BookOption { id: string; title: string }
interface AudioOption {
  id: string;
  filename: string;
  size: number;
  duration: number | null;
  lessonId: string | null;
  lessonTitle: string | null;
}

interface LessonData {
  id: string;
  slug: string;
  title: string;
  translations: Record<string, string>;
  description: string | null;
  descTranslations: Record<string, string>;
  lessonNumber: number | null;
  duration: number | null;
  status: string;
  publishedAt: string | null;
  categoryId: string | null;
  seriesId: string | null;
  bookId: string | null;
  audioMediaId: string | null;
}

interface EditLessonButtonProps {
  lesson: LessonData;
  categories: Option[];
  seriesList: SeriesOption[];
  books: BookOption[];
  audioFiles: AudioOption[];
}

export function EditLessonButton({ lesson, categories, seriesList, books, audioFiles }: EditLessonButtonProps) {
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
        await updateLesson(lesson.id, formData);
        setSuccess(true);
        setTimeout(() => closeModal(), 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed.");
      }
    });
  }

  // Format publishedAt as datetime-local string for the input
  const publishedAtValue = lesson.publishedAt
    ? new Date(lesson.publishedAt).toISOString().slice(0, 16)
    : "";

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
              <span className="text-sm font-semibold">Edit Lesson</span>
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
                <MF name="slug" label="Slug *" defaultValue={lesson.slug} required />
                <MF name="title" label="English Title *" defaultValue={lesson.title} required />
                <MF name="arTitle" label="Arabic Title" defaultValue={lesson.translations?.ar ?? ""} />
                <MF name="amTitle" label="Amharic Title" defaultValue={lesson.translations?.am ?? ""} />
                <MF name="lessonNumber" label="Lesson Number" defaultValue={lesson.lessonNumber != null ? String(lesson.lessonNumber) : ""} type="number" />
                <MF name="duration" label="Duration (seconds)" defaultValue={lesson.duration != null ? String(lesson.duration) : ""} type="number" />

                {/* Status */}
                <div>
                  <label htmlFor="edit-lesson-status" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Status</label>
                  <select id="edit-lesson-status" name="status" defaultValue={lesson.status}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700">
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>

                {/* Published At */}
                <div>
                  <label htmlFor="edit-lesson-publishedAt" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Published At</label>
                  <input id="edit-lesson-publishedAt" name="publishedAt" type="datetime-local" defaultValue={publishedAtValue}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700" />
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="edit-lesson-categoryId" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Category</label>
                  <select id="edit-lesson-categoryId" name="categoryId" defaultValue={lesson.categoryId ?? ""}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700">
                    <option value="">— None —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Series */}
                <div>
                  <label htmlFor="edit-lesson-seriesId" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Series</label>
                  <select id="edit-lesson-seriesId" name="seriesId" defaultValue={lesson.seriesId ?? ""}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700">
                    <option value="">— None —</option>
                    {seriesList.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>

                {/* Book */}
                <div className="sm:col-span-2">
                  <label htmlFor="edit-lesson-bookId" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Linked Book</label>
                  <select id="edit-lesson-bookId" name="bookId" defaultValue={lesson.bookId ?? ""}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700">
                    <option value="">— None —</option>
                    {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="edit-lesson-audioMediaId" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Audio file</label>
                <select id="edit-lesson-audioMediaId" name="audioMediaId" defaultValue={lesson.audioMediaId ?? ""}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700">
                  <option value="">— No audio —</option>
                  {audioFiles.map((audio) => {
                    const assignedElsewhere = audio.lessonId && audio.lessonId !== lesson.id;
                    const size = audio.size >= 1_000_000
                      ? `${(audio.size / 1_000_000).toFixed(1)} MB`
                      : `${Math.round(audio.size / 1_000)} KB`;
                    const owner = assignedElsewhere ? ` · linked to ${audio.lessonTitle}` : "";
                    return (
                      <option key={audio.id} value={audio.id} disabled={!!assignedElsewhere}>
                        {audio.filename} · {size}{owner}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-stone-500 mt-1">Only unassigned audio and this lesson’s current audio can be selected.</p>
              </div>

              <MT name="description" label="English Description" defaultValue={lesson.description ?? ""} />
              <MT name="arDescription" label="Arabic Description" defaultValue={lesson.descTranslations?.ar ?? ""} />

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

function MF({ name, label, defaultValue, required, type = "text" }: {
  name: string; label: string; defaultValue?: string; required?: boolean; type?: string;
}) {
  return (
    <div>
      <label htmlFor={`edit-lesson-${name}`} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{label}</label>
      <input id={`edit-lesson-${name}`} name={name} type={type} defaultValue={defaultValue} required={required}
        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700" />
    </div>
  );
}

function MT({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={`edit-lesson-${name}`} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{label}</label>
      <textarea id={`edit-lesson-${name}`} name={name} defaultValue={defaultValue} rows={2}
        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700 resize-none" />
    </div>
  );
}
