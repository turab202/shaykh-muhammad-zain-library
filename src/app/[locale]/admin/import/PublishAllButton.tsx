"use client";

import { useState } from "react";
import { Zap, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { publishAllPending } from "@/server/admin/actions";

export function PublishAllButton({ pendingCount }: { pendingCount: number }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{ published: number; skipped: number } | null>(null);

  async function handleClick() {
    if (!confirm(
      `This will immediately publish ${pendingCount} pending message(s) as live lessons on the public website.\n\n` +
      `Messages with confidence < 60% or no detected series will be skipped (left in the inbox for manual review).\n\n` +
      `Continue?`
    )) return;

    setStatus("running");
    try {
      const res = await publishAllPending();
      setResult(res ?? null);
      setStatus("done");
      // Reload page after 2s to reflect updated inbox count
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  if (status === "done" && result) {
    return (
      <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>
          <strong>{result.published}</strong> lessons published live.
          {result.skipped > 0 && <> <strong>{result.skipped}</strong> skipped (low confidence — still in inbox).</>}
          {" "}Reloading…
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Something went wrong — check server logs.
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={status === "running" || pendingCount === 0}
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-900 dark:bg-emerald-800 text-amber-100 rounded-lg text-xs font-semibold hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {status === "running"
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Zap className="w-3.5 h-3.5" />}
      {status === "running"
        ? "Publishing…"
        : `Publish All (${pendingCount})`}
    </button>
  );
}
