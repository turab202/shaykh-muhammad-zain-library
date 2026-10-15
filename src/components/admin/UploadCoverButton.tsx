"use client";

import { useRef, useState } from "react";
import { ImagePlus, CheckCircle, XCircle, Loader } from "lucide-react";

interface UploadCoverButtonProps {
  bookId: string;
  bookSlug: string;
  hasCover: boolean;
  currentCoverUrl?: string;
  compact?: boolean;
}

export function UploadCoverButton({
  bookId,
  bookSlug,
  hasCover,
  currentCoverUrl,
  compact = false,
}: UploadCoverButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus]   = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(currentCoverUrl ?? null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setStatus("uploading");
    setMessage("Uploading...");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`/api/admin/books/${bookId}/upload-cover`, {
        method: "POST",
        body: form,
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        setStatus("done");
        setMessage("✓ Cover uploaded!");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Upload failed");
        setPreview(currentCoverUrl ?? null);
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
      setPreview(currentCoverUrl ?? null);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Preview */}
      <div className={`relative w-12 h-16 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 flex items-center justify-center cursor-pointer ${compact ? "hidden" : ""}`}
           onClick={() => inputRef.current?.click()}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <ImagePlus className="w-5 h-5 text-stone-300 dark:text-stone-600" />
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <ImagePlus className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Upload button */}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={status === "uploading"}
        onClick={() => inputRef.current?.click()}
        aria-label={`${hasCover ? "Change" : "Add"} cover for ${bookSlug}`}
        title={`${hasCover ? "Change" : "Add"} cover for ${bookSlug}`}
        className={`inline-flex items-center rounded text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-60 ${compact ? "size-8 justify-center" : "gap-1 px-2 py-1"} ${
          hasCover
            ? "text-stone-500 hover:text-emerald-700 hover:bg-emerald-50"
            : "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
        }`}
      >
        {status === "uploading" ? (
          <Loader className="w-3 h-3 animate-spin" />
        ) : status === "done" ? (
          <CheckCircle className="w-3 h-3 text-emerald-600" />
        ) : status === "error" ? (
          <XCircle className="w-3 h-3 text-red-500" />
        ) : (
          <ImagePlus className="w-3 h-3" />
        )}
        {!compact && (hasCover ? "Change" : "Add Cover")}
      </button>
      {message && status === "error" && (
        <span className="text-[9px] text-red-500 max-w-[80px] text-center leading-tight">{message}</span>
      )}
    </div>
  );
}
