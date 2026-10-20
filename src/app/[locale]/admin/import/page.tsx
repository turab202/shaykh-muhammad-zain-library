import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  Send, CheckCircle, Clock, AlertCircle,
  Headphones, BookOpen, RefreshCw, ExternalLink,
} from "lucide-react";
import { ImportReviewForm } from "./ImportReviewForm";
import { PublishAllButton } from "./PublishAllButton";
import { AdminPageHeading, AdminSummaryGrid } from "@/components/admin/AdminPageChrome";

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
    <div className="mx-auto max-w-360 space-y-6">
      <AdminPageHeading title={t("importTitle")} description={t("importSubtitle")} icon={Send} />

      {/* Role explanation */}
      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 sm:grid-cols-2">
        {/* GitHub handles: bulk import */}
        <div className="border-b border-stone-200 p-4 dark:border-stone-800 sm:border-b-0 sm:border-e">
          <div className="mb-3 flex items-center gap-3">
            <ExternalLink className="size-5 text-stone-500" aria-hidden="true" />
            <span className="text-base font-bold text-stone-800 dark:text-stone-100">GitHub Actions</span>
            <span className="ms-auto rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Automated</span>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            Runs daily at 3am UTC. Downloads audio files from Telegram, uploads to B2 storage, and records metadata. No manual action needed.
          </p>
          <ul className="mb-5 space-y-2 text-sm text-stone-600 dark:text-stone-400">
            <li>✓ Download audio from @SheikhMuhammedZain</li>
            <li>✓ Upload to Backblaze B2</li>
            <li>✓ Import PDF books</li>
            <li>✓ Record message metadata</li>
          </ul>
          <a
            href="https://github.com/turab202/shaykh-muhammad-zain-library/actions/workflows/import-telegram.yml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Run workflow manually
          </a>
        </div>

        {/* Admin handles: review & quality */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-3">
            <CheckCircle className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span className="text-base font-bold text-emerald-900 dark:text-emerald-300">Your role</span>
            <span className="ms-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Manual</span>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            Review imported messages, fix metadata, approve content for publication.
          </p>
          <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
            <li>✓ Review & approve pending messages</li>
            <li>✓ Fix lesson titles and series assignments</li>
            <li>✓ Manage categories, series, books</li>
            <li>✓ Bulk-publish high-confidence content</li>
            <li>✓ Monitor audio/PDF coverage</li>
          </ul>
        </div>
      </div>

      <AdminSummaryGrid items={[
        { icon: Headphones, label: "Published lessons", value: publishedLessons },
        { icon: Headphones, label: "B2 audio files", value: audioCount, tone: "blue" },
        { icon: BookOpen, label: "PDFs in B2", value: pdfCount, tone: "amber" },
        { icon: Clock, label: "Awaiting review", value: pending.length, tone: pending.length ? "red" : "green" },
      ]} />

      {/* Architecture note */}
      <div className="rounded-e-xl border-s-4 border-amber-400 bg-amber-50/70 px-4 py-4 text-sm leading-relaxed text-amber-950 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-100">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Data integrity:</strong> Raw Telegram source data is never overwritten.
            Suggested metadata is stored separately. Human review required before publication.
          </span>
        </div>
      </div>

      {/* Bulk publish */}
      {pending.length > 0 && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center gap-3">
            <RefreshCw className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <p className="text-base font-semibold text-emerald-950 dark:text-emerald-100">
              Bulk Publish — {pending.length} message{pending.length !== 1 ? "s" : ""} pending review
            </p>
          </div>
          <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-200">
            Auto-publishes all pending messages with confidence ≥ 60%.
            Low-confidence messages stay in the inbox for manual review.
          </p>
          <PublishAllButton pendingCount={pending.length} />
        </div>
      )}

      {/* Pending review */}
      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-300 bg-white px-6 py-12 text-center dark:border-emerald-900 dark:bg-stone-900">
          <CheckCircle className="mx-auto mb-3 size-10 text-emerald-500" aria-hidden="true" />
          <p className="text-base font-semibold text-stone-800 dark:text-stone-100">Inbox is empty — no messages awaiting review.</p>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
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
          <div className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
            {processed.map((msg) => {
              const meta = msg.suggestedMetadata as Record<string, unknown>;
              const rejected = meta?.rejected as boolean | undefined;
              return (
                <div key={msg.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs sm:px-5">
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
