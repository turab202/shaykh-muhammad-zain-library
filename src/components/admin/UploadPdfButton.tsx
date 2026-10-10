"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle, XCircle, Loader } from "lucide-react";

interface UploadPdfButtonProps {
  bookId: string;
  bookTitle: string;
  hasPdf: boolean;
}

export function UploadPdfButton({ bookId, bookTitle, hasPdf }: UploadPdfButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus]   = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setMessage(`Uploading ${file.name}…`);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`/api/admin/books/${bookId}/upload-pdf`, {
        method: "POST",
        body: form,
      });
      const data = await res.json() as { ok?: boolean; error?: string; filename?: string };
      if (data.ok) {
        setStatus("done");
        setMessage(`✓ ${data.filename} uploaded`);
        // Reload to reflect new PDF status
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Upload failed");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.PDF"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={status === "uploading"}
        onClick={() => inputRef.current?.click()}
        title={`Upload PDF for ${bookTitle}`}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
          hasPdf
            ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 hover:bg-amber-100"
            : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100"
        }`}
      >
        {status === "uploading" ? (
          <Loader className="w-3 h-3 animate-spin" />
        ) : status === "done" ? (
          <CheckCircle className="w-3 h-3" />
        ) : status === "error" ? (
          <XCircle className="w-3 h-3" />
        ) : (
          <Upload className="w-3 h-3" />
        )}
        {hasPdf ? "Replace PDF" : "Upload PDF"}
      </button>
      {message && (
        <span className={`text-[10px] max-w-[140px] leading-tight ${
          status === "error" ? "text-red-600" : "text-stone-500"
        }`}>
          {message}
        </span>
      )}
    </div>
  );
}


