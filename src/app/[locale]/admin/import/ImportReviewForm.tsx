"use client";

import { useState } from "react";
import { Send, ChevronDown, ChevronUp, CheckCircle, XCircle, Music2, ClipboardList } from "lucide-react";
import { approveTelegramMessage, rejectTelegramMessage } from "@/server/admin/actions";

interface Props {
  message: {
    id: string;
    messageId: number;
    chatId: string;
    caption: string;
    date: string;
    audioFilename?: string;
    telegramFileUniqueId?: string;
    suggestedMetadata: Record<string, string | number | undefined>;
  };
  categories: { id: string; name: string }[];
  series: { id: string; title: string }[];
  approveLabel: string;
  rejectLabel: string;
  editLabel: string;
}

export function ImportReviewForm({ message, categories, series, approveLabel, rejectLabel }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const meta = message.suggestedMetadata;

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-16 w-full items-center justify-between gap-3 px-3 py-3 text-start transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/40 sm:px-4"
      >
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Send className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400">
              #{message.messageId} · {new Date(message.date).toLocaleDateString()}
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">{message.chatId}</span>
          </div>
          <p className="truncate text-xs font-semibold text-stone-800 dark:text-stone-100 sm:text-sm">
            {message.caption.slice(0, 120) || "(no caption)"}
          </p>
          {message.audioFilename && (
            <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-stone-400"><Music2 className="size-3 shrink-0" aria-hidden="true" />{message.audioFilename}</p>
          )}
        </div>
        <div className="shrink-0">
          {expanded ? <ChevronUp className="size-4 text-stone-400" aria-hidden="true" /> : <ChevronDown className="size-4 text-stone-400" aria-hidden="true" />}
        </div>
      </button>

      {/* Expanded review form */}
      {expanded && (
        <div className="space-y-4 border-t border-stone-200 px-3 py-4 dark:border-stone-800 sm:px-4">
          {/* Raw source (read-only) */}
          <div className="space-y-1 rounded-md border border-stone-200 bg-stone-50 p-3 text-[10px] text-stone-600 dark:border-stone-800 dark:bg-stone-950/50 dark:text-stone-400">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-stone-700 dark:text-stone-300">
              <ClipboardList className="size-3.5" aria-hidden="true" /> Raw Telegram Source · Read only
            </p>
            <p><span className="font-medium">Caption:</span> {message.caption || "(empty)"}</p>
            {message.audioFilename && (
              <p><span className="font-medium">Audio file:</span> {message.audioFilename}</p>
            )}
            {message.telegramFileUniqueId && (
              <p><span className="font-medium">File unique ID:</span> {message.telegramFileUniqueId}</p>
            )}
            <p><span className="font-medium">Date:</span> {new Date(message.date).toLocaleString()}</p>
          </div>

          {/* Approve form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setApproving(true);
              await approveTelegramMessage(message.id, new FormData(e.currentTarget));
              setApproving(false);
            }}
            className="space-y-4"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">
              <Send className="size-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" /> Suggested metadata
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Title (English) *
                </label>
                <input
                  name="title"
                  required
                  defaultValue={String(meta?.title ?? "")}
                  className="h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-xs text-stone-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Series</label>
                <select
                  name="seriesId"
                  defaultValue={String(meta?.seriesId ?? "")}
                  className="h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-xs text-stone-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                >
                  <option value="">— Not linked —</option>
                  {series.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Category</label>
                <select
                  name="categoryId"
                  defaultValue={String(meta?.categoryId ?? "")}
                  className="h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-xs text-stone-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                >
                  <option value="">— Not linked —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Lesson Number
                </label>
                <input
                  name="lessonNumber"
                  type="number"
                  defaultValue={meta?.lessonNumber ?? ""}
                  className="h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-xs text-stone-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Confidence
                </label>
                <input
                  readOnly
                  value={meta?.confidence ?? "manual"}
                  className="h-9 w-full cursor-not-allowed rounded-md border border-stone-200 bg-stone-100 px-3 text-xs text-stone-400 dark:border-stone-700 dark:bg-stone-800/50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Description (optional)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  className="w-full resize-y rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-stone-200 pt-3 dark:border-stone-800 sm:flex-row sm:flex-wrap sm:items-center">
              {/* Approve */}
              <button
                type="submit"
                disabled={approving}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-emerald-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-900 disabled:opacity-60 sm:min-h-9"
              >
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {approving ? "Saving…" : approveLabel}
              </button>

              {/* Reject — inline reason input instead of browser prompt() */}
              {!showRejectInput ? (
                <button
                  type="button"
                  onClick={() => setShowRejectInput(true)}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50 sm:min-h-9"
                >
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  {rejectLabel}
                </button>
              ) : (
                <div className="flex min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    autoFocus
                    className="h-11 min-w-0 flex-1 rounded-md border border-red-300 bg-white px-3 text-xs text-stone-900 outline-none focus:ring-2 focus:ring-red-400/30 dark:border-red-700 dark:bg-stone-950 dark:text-stone-100 sm:h-9"
                  />
                  <button
                    type="button"
                    disabled={rejecting}
                    onClick={async () => {
                      setRejecting(true);
                      await rejectTelegramMessage(message.id, rejectReason || undefined);
                      setRejecting(false);
                      setShowRejectInput(false);
                    }}
                    className="min-h-11 shrink-0 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60 sm:min-h-9"
                  >
                    {rejecting ? "…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                    className="min-h-11 shrink-0 rounded-md px-3 py-2 text-xs text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-300 sm:min-h-9"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
