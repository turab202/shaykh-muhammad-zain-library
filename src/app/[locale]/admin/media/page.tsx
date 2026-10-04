import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";

export default async function AdminMediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }
  const t = await getTranslations({ locale, namespace: "admin" });

  const media = await prisma.media.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      lesson: { select: { title: true, slug: true } },
      book: { select: { title: true, slug: true } },
    },
  });

  const totalAudio = media.filter((m) => m.mediaType === "AUDIO").length;
  const totalPdf = media.filter((m) => m.mediaType === "PDF").length;
  const totalBytes = media.reduce((sum, m) => sum + m.size, 0);

  function fmt(bytes: number) {
    if (bytes > 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
    if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    return `${(bytes / 1_000).toFixed(0)} KB`;
  }

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("media")}</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Audio files", value: totalAudio },
          { label: "PDF files", value: totalPdf },
          { label: "Total storage", value: fmt(totalBytes) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
            <div className="text-lg font-bold text-stone-900 dark:text-stone-100">{value}</div>
            <div className="text-xs text-stone-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800">
            <tr>{["Filename", "Type", "Size", "Duration", "Linked to", "Storage", "Created"].map((h) => <th key={h} className="px-4 py-3 text-start font-semibold text-stone-600 dark:text-stone-400">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {media.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No media records yet. Media is added automatically when lessons are created.</td></tr>
            ) : media.map((m) => (
              <tr key={m.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400 max-w-[200px] truncate" title={m.filename}>{m.filename}</td>
                <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${m.mediaType === "AUDIO" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"}`}>{m.mediaType}</span></td>
                <td className="px-4 py-3 text-stone-500">{fmt(m.size)}</td>
                <td className="px-4 py-3 text-stone-500">{m.duration ? `${Math.floor(m.duration / 60)}m` : "—"}</td>
                <td className="px-4 py-3 text-stone-500 max-w-[160px] truncate">
                  {m.lesson ? <Link href={`/duruus/${m.lesson.slug}`} className="text-emerald-700 hover:underline">{m.lesson.title}</Link>
                    : m.book ? <Link href={`/kutub/${m.book.slug}`} className="text-amber-700 hover:underline">{m.book.title}</Link>
                    : "—"}
                </td>
                <td className="px-4 py-3 text-stone-400 font-mono text-[10px]">{m.storageProvider}</td>
                <td className="px-4 py-3 text-stone-400">{new Date(m.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
