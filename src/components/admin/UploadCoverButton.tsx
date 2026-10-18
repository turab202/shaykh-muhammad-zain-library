"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, CheckCircle, XCircle, Loader } from "lucide-react";

interface UploadCoverButtonProps {
  bookId: string;
  bookSlug: string;
  hasCover: boolean;
  currentCoverUrl?: string;
  compact?: boolean;
  thumbnailSize?: "table" | "card";
}

export function UploadCoverButton({
  bookId,
  bookSlug,
  hasCover,
  currentCoverUrl,
  compact = false,
  thumbnailSize,
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
      if (res.ok && data.ok) {
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
    } finally {
      e.target.value = "";
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
          aria-label={`${hasCover ? "Change" : "Add"} cover for ${bookSlug}`}
          title={`${hasCover ? "Change" : "Add"} cover for ${bookSlug}`}
          className={`group relative flex items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-100 transition-colors hover:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-wait disabled:opacity-60 dark:border-stone-700 dark:bg-stone-800 ${thumbnailSize === "table" ? "h-12 w-9" : "h-[86px] w-[62px]"}`}
        >
          {preview ? (
            <Image
              src={preview}
              alt={`${bookSlug} cover`}
              fill
              sizes={thumbnailSize === "table" ? "36px" : "62px"}
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
          aria-label={`${hasCover ? "Change" : "Add"} cover for ${bookSlug}`}
          title={`${hasCover ? "Change" : "Add"} cover for ${bookSlug}`}
          className={`inline-flex cursor-pointer items-center rounded text-[10px] font-medium transition-colors disabled:opacity-60 ${compact ? "size-8 justify-center" : "gap-1 px-2 py-1"} ${
            hasCover
              ? "text-stone-500 hover:bg-emerald-50 hover:text-emerald-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
          }`}
        >
          {status === "uploading" ? (
            compact && <Loader className="w-3 h-3 animate-spin" />
          ) : status === "done" ? (
            compact && <CheckCircle className="w-3 h-3 text-emerald-600" />
          ) : status === "error" ? (
            compact && <XCircle className="w-3 h-3 text-red-500" />
          ) : (
            compact && <ImagePlus className="w-3 h-3" />
          )}
          {!compact && (hasCover ? "Change Cover" : "Add Cover")}
        </button>
      )}
      {message && status === "error" && (
        <span className="text-[9px] text-red-500 max-w-[80px] text-center leading-tight">{message}</span>
      )}
    </div>
  );
}
