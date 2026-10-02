"use client";

import { useState } from "react";
import { Send, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
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
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-start hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors cursor-pointer"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              chatId: {message.chatId} · #{message.messageId} · {new Date(message.date).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
            {message.caption.slice(0, 120) || "(no caption)"}
          </p>
          {message.audioFilename && (
            <p className="text-[11px] text-stone-400 mt-0.5">🎵 {message.audioFilename}</p>
          )}
        </div>
        <div className="shrink-0 ms-4">
          {expanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>

      {/* Expanded review form */}
      {expanded && (
        <div className="border-t border-stone-200 dark:border-stone-800 px-5 py-5 space-y-5">
          {/* Raw source (read-only) */}
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-lg text-xs text-stone-600 dark:text-stone-400 space-y-1">
            <p className="font-semibold text-stone-700 dark:text-stone-300 mb-2">
              📋 Raw Telegram Source (preserved, read-only)
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
            <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              ✏️ Suggested Metadata (editable — stored separately from raw source)
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
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">Series</label>
                <select
                  name="seriesId"
                  defaultValue={String(meta?.seriesId ?? "")}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
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
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
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
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Confidence
                </label>
                <input
                  readOnly
                  value={meta?.confidence ?? "manual"}
                  className="w-full px-3 py-2 bg-stone-100 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-400 cursor-not-allowed"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Description (optional)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Approve */}
              <button
                type="submit"
                disabled={approving}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-900 text-amber-100 rounded-lg text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer disabled:opacity-60"
              >
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {approving ? "Saving…" : approveLabel}
              </button>

              {/* Reject — inline reason input instead of browser prompt() */}
              {!showRejectInput ? (
                <button
                  type="button"
                  onClick={() => setShowRejectInput(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  {rejectLabel}
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    className="flex-1 min-w-0 px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-red-300 dark:border-red-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-red-400"
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
                    className="shrink-0 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {rejecting ? "…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                    className="shrink-0 px-2 py-2 rounded-lg text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors cursor-pointer"
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
