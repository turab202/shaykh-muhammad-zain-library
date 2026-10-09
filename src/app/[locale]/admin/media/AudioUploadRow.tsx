"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle, XCircle, Loader, ExternalLink } from "lucide-react";
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
      <div className="px-5 py-3 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20">
        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-medium text-stone-700 dark:text-stone-300 flex-1">
          #{String(lessonNumber).padStart(3,"0")} {title}
        </span>
        <span className="text-xs text-emerald-700">{message}</span>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 flex items-center gap-3">
      {/* Lesson number */}
      <span className="w-10 text-xs font-mono text-stone-400 shrink-0 text-center">
        #{String(lessonNumber).padStart(3,"0")}
      </span>

      {/* Title + Telegram filename */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/duruus/${slug}`}
          className="text-sm font-medium text-stone-800 dark:text-stone-200 hover:text-emerald-700 truncate block"
        >
          {title}
        </Link>
        {audioFilename && (
          <p className="text-[11px] text-stone-400 truncate mt-0.5">
            TG file: {audioFilename}
          </p>
        )}
        {status === "error" && (
          <p className="text-[11px] text-red-500 mt-0.5">{message}</p>
        )}
      </div>

      {/* Open in Telegram */}
      {telegramMessageId && (
        <a
          href={`https://t.me/SheikhMuhammedZain/${telegramMessageId}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Telegram to download"
          className="p-1.5 text-stone-400 hover:text-stone-700 transition-colors shrink-0"
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-60 shrink-0 cursor-pointer"
      >
        {status === "uploading" ? (
          <><Loader className="w-3 h-3 animate-spin" />Uploading…</>
        ) : (
          <><Upload className="w-3 h-3" />Upload MP3</>
        )}
      </button>
    </div>
  );
}
