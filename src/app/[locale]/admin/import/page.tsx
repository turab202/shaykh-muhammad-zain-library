import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Send, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { ImportReviewForm } from "./ImportReviewForm";
import { RunImportButton } from "./RunImportButton";
import { PublishAllButton } from "./PublishAllButton";

export default async function AdminImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const [pending, processed, categories, series] = await Promise.all([
    prisma.telegramMessage.findMany({
      where: { processedAt: null },
      orderBy: { date: "desc" },
    }),
    prisma.telegramMessage.findMany({
      where: { processedAt: { not: null } },
      orderBy: { processedAt: "desc" },
      take: 10,
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.series.findMany({ where: { status: "PUBLISHED" }, orderBy: { order: "asc" }, select: { id: true, title: true } }),
  ]);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Send className="w-5 h-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("importTitle")}</h1>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-2xl">{t("importSubtitle")}</p>
      </div>

      {/* Architectural note */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong>Architecture:</strong> Raw Telegram source data is preserved unchanged. 
            The &ldquo;Suggested Metadata&rdquo; fields below are stored separately and never overwrite the original record.
            Human review and approval are mandatory before any content is published.
          </div>
        </div>
      </div>

      {/* Run importer */}
      <div className="p-4 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-3">
        <div>
          <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">Pull new messages from @SheikhMuhammedZain</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Fetches the latest 50 messages (metadata only — no audio download). New messages appear in the inbox below.</p>
        </div>

        {/* Local dev button */}
        <RunImportButton refreshLabel="Pull from Telegram (local dev only)" />

        {/* GitHub Actions link for production */}
        <div className="pt-2 border-t border-stone-200 dark:border-stone-700">
          <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5">
            🚀 To import on the live site — use GitHub Actions:
          </p>
          <a
            href="https://github.com/turab202/shaykh-muhammad-zain-library/actions/workflows/import-telegram.yml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-stone-800 dark:bg-stone-700 text-white text-xs font-medium rounded-lg hover:bg-stone-700 dark:hover:bg-stone-600 transition-colors"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            Open GitHub Actions → Run workflow
          </a>
          <p className="text-[11px] text-stone-400 mt-1.5">
            Choose &quot;Metadata only&quot; for a fast scan, or leave it off to download audio files.
            PDFs are always imported automatically.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Stat icon={<Clock className="w-4 h-4" />} label={t("needsReview")} value={pending.length} color="text-amber-600 dark:text-amber-400" />
        <Stat icon={<CheckCircle className="w-4 h-4" />} label={t("alreadyOrganized")} value={processed.filter((m) => !(m.suggestedMetadata as Record<string, unknown>)?.rejected).length} color="text-emerald-600 dark:text-emerald-400" />
        <Stat icon={<XCircle className="w-4 h-4" />} label="Rejected" value={processed.filter((m) => (m.suggestedMetadata as Record<string, unknown>)?.rejected).length} color="text-red-600 dark:text-red-400" />
      </div>

      {/* Bulk publish — one-click publish all high-confidence messages */}
      {pending.length > 0 && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
            ⚡ Bulk Publish — One-Click Archive Import
          </p>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Publishes all {pending.length} pending message(s) with confidence ≥ 60% directly to the public website.
            Series, categories and books are created automatically. Low-confidence messages remain in the inbox for manual review.
          </p>
          <PublishAllButton pendingCount={pending.length} />
        </div>
      )}

      {/* Pending review */}
      {pending.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Inbox is empty — no messages awaiting review.</p>
          <p className="text-xs text-stone-400 mt-1">Telegram messages will appear here after running the importer.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">{t("needsReview")} ({pending.length})</h2>
          {pending.map((msg) => (
            <ImportReviewForm
              key={msg.id}
              message={{
                id: msg.id,
                messageId: msg.messageId,
                chatId: msg.chatId,
                caption: msg.caption ?? msg.text ?? "",
                date: msg.date.toISOString(),
                audioFilename: msg.audioFilename ?? undefined,
                telegramFileUniqueId: msg.telegramFileUniqueId ?? undefined,
                suggestedMetadata: msg.suggestedMetadata as Record<string, string | number | undefined>,
              }}
              categories={categories}
              series={series}
              approveLabel={t("approve")}
              rejectLabel={t("reject")}
              editLabel={t("edit")}
            />
          ))}
        </div>
      )}

      {/* Recently processed */}
      {processed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200 mb-3">{t("recentActivity")}</h2>
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl divide-y divide-stone-100 dark:divide-stone-800">
            {processed.map((msg) => {
              const meta = msg.suggestedMetadata as Record<string, unknown>;
              const rejected = meta?.rejected as boolean | undefined;
              return (
                <div key={msg.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-stone-800 dark:text-stone-200 truncate block">{msg.caption?.slice(0, 80) ?? `Message #${msg.messageId}`}</span>
                    <span className="text-stone-400">chatId: {msg.chatId} · msg #{msg.messageId}</span>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded ${rejected ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"}`}>
                    {rejected ? "Rejected" : "Approved"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 flex items-center gap-3">
      <div className={color}>{icon}</div>
      <div>
        <div className="text-lg font-bold text-stone-900 dark:text-stone-100">{value}</div>
        <div className="text-[11px] text-stone-500">{label}</div>
      </div>
    </div>
  );
}
