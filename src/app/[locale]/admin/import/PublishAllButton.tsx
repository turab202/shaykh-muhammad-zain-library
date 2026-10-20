"use client";

import { useRef, useState } from "react";
import { Zap, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { publishAllPending } from "@/server/admin/actions";

export function PublishAllButton({ pendingCount }: { pendingCount: number }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{ published: number; skipped: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openConfirmation() {
    setErrorMessage("");
    setConfirmOpen(true);
    requestAnimationFrame(() => dialogRef.current?.showModal());
  }

  function closeConfirmation() {
    dialogRef.current?.close();
    setConfirmOpen(false);
  }

  async function handleConfirm() {
    setStatus("running");
    setErrorMessage("");
    try {
      const res = await publishAllPending();
      setResult(res ?? null);
      setStatus("done");
      closeConfirmation();
      // Reload page after 2s to reflect updated inbox count
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to publish pending messages.");
    }
  }

  if (status === "done" && result) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>
          <strong>{result.published}</strong> lessons published live.
          {result.skipped > 0 && <> <strong>{result.skipped}</strong> skipped (low confidence — still in inbox).</>}
          {" "}Reloading…
        </span>
      </div>
    );
  }

  return (
    <>
      {status === "error" && (
        <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {errorMessage}
        </p>
      )}
      <button
        type="button"
        disabled={status === "running" || pendingCount === 0}
        onClick={openConfirmation}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-800 dark:hover:bg-emerald-700"
      >
        {status === "running"
          ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          : <Zap className="size-4" aria-hidden="true" />}
        {status === "running" ? "Publishing…" : `Publish All (${pendingCount})`}
      </button>
      {confirmOpen && (
        <dialog
          ref={dialogRef}
          aria-labelledby="publish-confirm-title"
          onClose={() => setConfirmOpen(false)}
          onClick={(event) => { if (event.target === dialogRef.current && status !== "running") closeConfirmation(); }}
          className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-stone-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
            <h2 id="publish-confirm-title" className="text-base font-semibold text-stone-900 dark:text-stone-100">Publish pending messages?</h2>
            <button type="button" onClick={closeConfirmation} disabled={status === "running"} aria-label="Close dialog" className="inline-flex size-11 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-50 dark:hover:bg-stone-800"><X className="size-5" aria-hidden="true" /></button>
          </div>
          <div className="space-y-3 px-5 py-5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
            <p>This will publish up to {pendingCount} pending messages as live lessons on the public website.</p>
            <p>Messages below 60% confidence or without a detected series will be skipped and remain in the inbox for manual review.</p>
            <p className="font-semibold text-stone-800 dark:text-stone-100">Review the pending items before continuing.</p>
            {status === "error" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{errorMessage}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-stone-200 bg-stone-50 px-5 py-4 dark:border-stone-800 dark:bg-stone-900/50">
            <button type="button" onClick={closeConfirmation} disabled={status === "running"} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">Cancel</button>
            <button type="button" onClick={handleConfirm} disabled={status === "running"} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-800 dark:hover:bg-emerald-700">
              {status === "running" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {status === "running" ? "Publishing…" : "Publish lessons"}
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
