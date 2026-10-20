"use client";

import { useRef, useState } from "react";
import { CheckCircle, Loader, ExternalLink, Music2 } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface Props {
  lessonId: string;
  lessonNumber: number;
  title: string;
  slug: string;
  telegramMessageId: number | null;
  audioFilename: string | null;
}

export function AudioUploadRow({
  lessonId, lessonNumber, title, slug,
  telegramMessageId, audioFilename,
}: Props) {
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
      const res = await fetch(`/api/admin/lessons/${lessonId}/upload-audio`, {
        method: "POST",
        body: form,
      });
      const data = await res.json() as { ok?: boolean; error?: string; filename?: string; duration?: number };
      if (data.ok) {
        setStatus("done");
        const mins = data.duration ? Math.round(data.duration / 60) : 0;
        setMessage(`✓ Uploaded (${mins} min est.)`);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Upload failed");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-start gap-2 bg-emerald-50 px-3 py-3 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-medium text-stone-700 dark:text-stone-300 sm:flex-1 sm:text-sm">
          #{String(lessonNumber).padStart(3,"0")} {title}
        </span>
        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 sm:text-xs">{message}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-2.5 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
      {/* Lesson number */}
      <span className="hidden w-10 shrink-0 text-center font-mono text-xs text-stone-400 sm:block">
        #{String(lessonNumber).padStart(3,"0")}
      </span>

      {/* Title + Telegram filename */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/duruus/${slug}`}
          className="block truncate text-xs font-semibold text-stone-800 hover:text-emerald-700 dark:text-stone-200 sm:text-sm"
        >
          {title}
        </Link>
        {audioFilename && (
            <p className="mt-0.5 truncate text-[10px] text-stone-400 sm:text-[11px]">
            TG file: {audioFilename}
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="mt-0.5 text-[10px] text-red-500 sm:text-[11px]">{message}</p>
        )}
      </div>

      {/* Open in Telegram */}
      {telegramMessageId && (
        <a
          href={`https://t.me/SheikhMuhammedZain/${telegramMessageId}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Telegram to download"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 sm:size-8 dark:hover:bg-stone-800 dark:hover:text-stone-200"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}

      {/* Upload button */}
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.m4a,.aac,.ogg,.wav"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={status === "uploading"}
        onClick={() => inputRef.current?.click()}
        className="flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-60 sm:w-auto dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
      >
        {status === "uploading" ? (
          <><Loader className="w-3 h-3 animate-spin" />Uploading…</>
        ) : (
          <><Music2 className="size-3.5" />Upload MP3</>
        )}
      </button>
    </div>
  );
}
