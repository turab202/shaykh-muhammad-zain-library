"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, XCircle, Loader } from "lucide-react";

export function RunImportButton({ refreshLabel }: { refreshLabel: string }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);

  async function runImport() {
    setStatus("running");
    setLog([]);
    setShowLog(true);

    // Start the job
    const res = await fetch("/api/admin/run-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 50 }),
    });
    if (!res.ok) {
      setStatus("error");
      setLog(["Failed to start importer — check server logs."]);
      return;
    }
    const { jobId } = await res.json() as { jobId: string };

    // Poll for status every 2 seconds
    const poll = setInterval(async () => {
      const statusRes = await fetch(`/api/admin/import-status/${jobId}`);
      if (!statusRes.ok) return;
      const data = await statusRes.json() as {
        status: string;
        log: string[];
        exitCode: number | null;
      };
      setLog(data.log ?? []);
      if (data.status === "done" || data.status === "error") {
        setStatus(data.status as "done" | "error");
        clearInterval(poll);
        // Reload page after 2s to show new inbox messages
        if (data.status === "done") {
          setTimeout(() => window.location.reload(), 2000);
        }
      }
    }, 2000);

    // Safety timeout after 5 minutes
    setTimeout(() => clearInterval(poll), 300_000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={status === "running"}
          onClick={runImport}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-900 text-amber-100 rounded-lg text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === "running" ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {status === "running" ? "Importing…" : refreshLabel}
        </button>

        {status === "done" && (
          <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Import complete — reloading…
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
            <XCircle className="w-3.5 h-3.5" /> Import failed — see log below
          </span>
        )}

        {log.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 underline"
          >
            {showLog ? "Hide log" : "Show log"}
          </button>
        )}
      </div>

      {showLog && log.length > 0 && (
        <div className="bg-stone-900 dark:bg-black rounded-lg p-3 text-[11px] font-mono text-stone-300 max-h-64 overflow-y-auto space-y-0.5">
          {log.map((line, i) => (
            <div
              key={i}
              className={
                line.includes("ERROR") ? "text-red-400" :
                line.includes("✓") || line.includes("inserted") ? "text-emerald-400" :
                line.includes("skip") ? "text-stone-500" :
                "text-stone-300"
              }
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
