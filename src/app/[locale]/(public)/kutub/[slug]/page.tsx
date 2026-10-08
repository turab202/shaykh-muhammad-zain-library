import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { getBookBySlug } from "@/server/books/queries";
import { getCategoryBySlug } from "@/server/categories/queries";
import { getSeriesBySlug } from "@/server/series/queries";
import type { Locale } from "@/types/i18n";
import { BookOpen, Layers, User, Tag, ChevronRight, FileText } from "lucide-react";
import { PdfViewer } from "@/components/books/PdfViewer";

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function BookDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const l = locale as Locale;

  const tBook = await getTranslations({ locale, namespace: "book" });
  const tNav  = await getTranslations({ locale, namespace: "nav" });

  const book = await getBookBySlug(slug, l);
  if (!book) notFound();

  const category = book.categoryId ? await getCategoryBySlug(book.categoryId, l) : null;
  const series   = book.seriesId   ? await getSeriesBySlug(book.seriesId, l)     : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      <Breadcrumbs items={[
        { label: tNav("books"), href: "/kutub" },
        ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : []),
        { label: book.title },
      ]} />

      {/* ── Book header ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-emerald-800 to-amber-700" />

        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">

            {/* Cover image */}
            <div className="w-28 h-36 shrink-0 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 shadow-sm flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900/10 to-amber-900/10 dark:from-emerald-400/10 dark:to-amber-400/10">
              {book.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.coverImageUrl}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <BookOpen className="w-10 h-10 text-emerald-800/50 dark:text-emerald-400/50" aria-hidden="true" />
                  <span className="text-[10px] font-bold text-emerald-800/40 dark:text-emerald-400/40 uppercase tracking-wider text-center px-2 leading-tight mt-2">
                    {category?.name ?? "Islamic Text"}
                  </span>
                </>
              )}
            </div>

            {/* Book info */}
            <div className="flex-1 min-w-0">

              {/* Category */}
              {category && (
                <Link
                  href={`/categories/${category.slug}`}
                  className="inline-flex items-center gap-1 mb-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider hover:underline"
                >
                  <Tag className="w-3 h-3" aria-hidden="true" />
                  {category.name}
                </Link>
              )}

              {/* Title */}
              <h1 className="font-serif font-bold text-2xl sm:text-3xl text-stone-900 dark:text-stone-100 leading-tight mb-1">
                {book.title}
              </h1>

              {/* Author */}
              {book.author && (
                <p className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400 italic mb-4">
                  <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {book.author}
                </p>
              )}

              {/* PDF badge */}
              {book.pdfAvailable && (
                <div className="flex flex-wrap gap-2 mb-5">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-xs font-medium text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    PDF{book.pdfSize ? ` · ${book.pdfSize}` : ""}
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {series && (
                  <Link
                    href={`/series/${series.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-900 dark:bg-emerald-800 text-amber-100 text-xs font-semibold hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                    {tBook("goToSeries")}
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                )}
                {book.pdfUrl && (
                  <a
                    href="#pdf-viewer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-700 dark:border-amber-700 text-amber-800 dark:text-amber-400 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    {tBook("pdfAvailable")}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="mt-6 pt-6 border-t border-stone-100 dark:border-stone-800">
              <h2 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
                About this book
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                {book.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── PDF Viewer ──────────────────────────────────────────────── */}
      {book.pdfUrl ? (
        <div id="pdf-viewer">
          <PdfViewer
            pdfUrl={book.pdfUrl}
            title={book.title}
            pdfSize={book.pdfSize}
          />
        </div>
      ) : (
        /* No PDF yet */
        <div className="py-16 text-center border border-dashed border-stone-300 dark:border-stone-700 rounded-2xl">
          <BookOpen className="w-12 h-12 mx-auto text-stone-300 dark:text-stone-600 mb-4" aria-hidden="true" />
          <p className="font-serif font-bold text-base text-stone-700 dark:text-stone-300 mb-1">
            PDF not yet available
          </p>
          <p className="text-sm text-stone-400 dark:text-stone-500 max-w-xs mx-auto leading-relaxed">
            The PDF for this kitab will be added soon. You can listen to the audio lessons via the Series page.
          </p>
          {series && (
            <Link
              href={`/series/${series.slug}`}
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-lg bg-emerald-900 dark:bg-emerald-800 text-amber-100 text-sm font-semibold hover:bg-emerald-800 transition-colors"
            >
              <Layers className="w-4 h-4" aria-hidden="true" />
              Go to Audio Series
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

    </div>
  );
}
