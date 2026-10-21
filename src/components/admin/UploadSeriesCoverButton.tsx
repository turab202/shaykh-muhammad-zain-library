"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle, ImagePlus, Loader, XCircle } from "lucide-react";

interface UploadSeriesCoverButtonProps {
  seriesId: string;
  seriesSlug: string;
  hasCover: boolean;
  currentCoverUrl?: string;
  compact?: boolean;
  thumbnailSize?: "table" | "card";
}

export function UploadSeriesCoverButton({
  seriesId,
  seriesSlug,
  hasCover,
  currentCoverUrl,
  compact = false,
  thumbnailSize,
}: UploadSeriesCoverButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(currentCoverUrl ?? null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
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
      setPreview(currentCoverUrl ?? null);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={handleFile}
      />
      {thumbnailSize ? (
        <button
          type="button"
          disabled={status === "uploading"}
          onClick={() => inputRef.current?.click()}
          aria-label={`${hasCover ? "Change" : "Add"} cover for ${seriesSlug}`}
          title={`${hasCover ? "Change" : "Add"} cover for ${seriesSlug}`}
          className={`group relative flex items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-100 transition-colors hover:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-wait disabled:opacity-60 dark:border-stone-700 dark:bg-stone-800 ${thumbnailSize === "table" ? "size-14" : "h-[86px] w-[62px]"}`}
        >
          {preview ? (
            <Image
              src={preview}
              alt={`${seriesSlug} cover`}
              fill
              sizes={thumbnailSize === "table" ? "56px" : "62px"}
              unoptimized
              className="object-cover"
            />
          ) : (
            <ImagePlus className="size-5 text-stone-400 dark:text-stone-500" aria-hidden="true" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {status === "uploading" ? <Loader className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          </span>
        </button>
      ) : (
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
            compact && <Loader className="h-3 w-3 animate-spin" />
          ) : status === "done" ? (
            compact && <CheckCircle className="h-3 w-3 text-emerald-600" />
          ) : status === "error" ? (
            compact && <XCircle className="h-3 w-3 text-red-500" />
          ) : (
            compact && <ImagePlus className="h-3 w-3" />
          )}
          {!compact && (hasCover ? "Change Cover" : "Add Cover")}
        </button>
      )}
      {message && status === "error" && (
        <span className="max-w-[80px] text-center text-[9px] leading-tight text-red-500">{message}</span>
      )}
    </div>
  );
}
