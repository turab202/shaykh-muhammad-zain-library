import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  Send, CheckCircle, XCircle, Clock, AlertCircle,
  Headphones, BookOpen, RefreshCw, ExternalLink,
} from "lucide-react";
import { ImportReviewForm } from "./ImportReviewForm";
import { PublishAllButton } from "./PublishAllButton";

export const revalidate = 60;

export default async function AdminImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const [pending, processed, categories, series, audioCount, pdfCount] = await Promise.all([
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
    prisma.media.count({ where: { mediaType: "AUDIO", storageKey: { startsWith: "s3://" } } }),
    prisma.media.count({ where: { mediaType: "PDF", storageKey: { startsWith: "s3://" } } }),
  ]);

  const publishedLessons = await prisma.lesson.count({ where: { status: "PUBLISHED" } });

  return (
    <div className="max-w-5xl space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Send className="w-5 h-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("importTitle")}</h1>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-2xl">{t("importSubtitle")}</p>
      </div>

      {/* Role explanation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* GitHub handles: bulk import */}
        <div className="p-4 bg-stone-900 dark:bg-stone-950 border border-stone-700 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className="w-4 h-4 text-white" aria-hidden="true" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">GitHub Actions</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-700 text-white font-semibold ml-auto">Automated</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed mb-3">
            Runs daily at 3am UTC. Downloads audio files from Telegram, uploads to B2 storage, and records metadata. No manual action needed.
          </p>
          <ul className="text-xs text-stone-400 space-y-1 mb-4">
            <li>✓ Download audio from @SheikhMuhammedZain</li>
            <li>✓ Upload to Backblaze B2</li>
            <li>✓ Import PDF books</li>
            <li>✓ Record message metadata</li>
          </ul>
          <a
            href="https://github.com/turab202/shaykh-muhammad-zain-library/actions/workflows/import-telegram.yml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-stone-900 text-xs font-semibold rounded-lg hover:bg-stone-100 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Run workflow manually
          </a>
        </div>

        {/* Admin handles: review & quality */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">Your Role (Admin)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold ml-auto">Manual</span>
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed mb-3">
            Review imported messages, fix metadata, approve content for publication.
          </p>
          <ul className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
            <li>✓ Review & approve pending messages</li>
            <li>✓ Fix lesson titles and series assignments</li>
            <li>✓ Manage categories, series, books</li>
            <li>✓ Bulk-publish high-confidence content</li>
            <li>✓ Monitor audio/PDF coverage</li>
          </ul>
        </div>
      </div>

      {/* Progress stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Headphones className="w-4 h-4" />} label="Published Lessons" value={publishedLessons} color="text-emerald-600 dark:text-emerald-400" />
        <Stat icon={<Headphones className="w-4 h-4" />} label="With B2 Audio" value={audioCount} color="text-emerald-600 dark:text-emerald-400" />
        <Stat icon={<BookOpen className="w-4 h-4" />} label="PDFs in B2" value={pdfCount} color="text-amber-600 dark:text-amber-400" />
        <Stat icon={<Clock className="w-4 h-4" />} label="Awaiting Review" value={pending.length} color="text-orange-500 dark:text-orange-400" />
      </div>

      {/* Architecture note */}
      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>Data integrity:</strong> Raw Telegram source data is never overwritten.
            Suggested metadata is stored separately. Human review required before publication.
          </span>
        </div>
      </div>

      {/* Bulk publish */}
      {pending.length > 0 && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
              Bulk Publish — {pending.length} message{pending.length !== 1 ? "s" : ""} pending review
            </p>
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Auto-publishes all pending messages with confidence ≥ 60%.
            Low-confidence messages stay in the inbox for manual review.
          </p>
          <PublishAllButton pendingCount={pending.length} />
        </div>
      )}

      {/* Pending review */}
      {pending.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Inbox is empty — no messages awaiting review.</p>
          <p className="text-xs text-stone-400 mt-1">
            GitHub Actions runs daily and will populate this inbox automatically.
          </p>
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
                    <span className="font-medium text-stone-800 dark:text-stone-200 truncate block">
                      {msg.audioFilename?.slice(0, 60) ?? msg.caption?.slice(0, 60) ?? `Message #${msg.messageId}`}
                    </span>
                    <span className="text-stone-400">msg #{msg.messageId}</span>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded ${
                    rejected
                      ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                      : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                  }`}>
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
        <div className="text-lg font-bold text-stone-900 dark:text-stone-100">{value.toLocaleString()}</div>
        <div className="text-[11px] text-stone-500">{label}</div>
      </div>
    </div>
  );
}
