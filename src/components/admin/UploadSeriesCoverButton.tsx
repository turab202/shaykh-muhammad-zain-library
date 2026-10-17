"use client";

import { useRef, useState } from "react";
import { CheckCircle, ImagePlus, Loader, XCircle } from "lucide-react";

interface UploadSeriesCoverButtonProps {
  seriesId: string;
  seriesSlug: string;
  hasCover: boolean;
  currentCoverUrl?: string;
  compact?: boolean;
}

export function UploadSeriesCoverButton({
  seriesId,
  seriesSlug,
  hasCover,
  currentCoverUrl,
  compact = false,
}: UploadSeriesCoverButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setMessage("Uploading...");

    const form = new FormData();
    form.append("file", file);

    try {
      const response = await fetch(`/api/admin/series/${seriesId}/upload-cover`, {
        method: "POST",
        body: form,
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      setStatus("done");
      setMessage("Cover uploaded!");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {!compact && (
        <div
          className="relative flex h-16 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"
          onClick={() => inputRef.current?.click()}
        >
          {currentCoverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentCoverUrl} alt={`${seriesSlug} cover`} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5 text-stone-300 dark:text-stone-600" />
          )}
        </div>
      )}

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
        aria-label={`${hasCover ? "Change" : "Add"} cover for ${seriesSlug}`}
        title={`${hasCover ? "Change" : "Add"} cover for ${seriesSlug}`}
        className={`inline-flex cursor-pointer items-center rounded text-[10px] font-medium transition-colors disabled:opacity-60 ${compact ? "size-8 justify-center" : "gap-1 px-2 py-1"} ${
          hasCover
            ? "text-stone-500 hover:bg-emerald-50 hover:text-emerald-700"
            : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
        }`}
      >
        {status === "uploading" ? (
          <Loader className="h-3 w-3 animate-spin" />
        ) : status === "done" ? (
          <CheckCircle className="h-3 w-3 text-emerald-600" />
        ) : status === "error" ? (
          <XCircle className="h-3 w-3 text-red-500" />
        ) : (
          <ImagePlus className="h-3 w-3" />
        )}
        {!compact && (hasCover ? "Change" : "Add Cover")}
      </button>
      {message && status === "error" && (
        <span className="max-w-[80px] text-center text-[9px] leading-tight text-red-500">{message}</span>
      )}
    </div>
  );
}
