import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { getBookBySlug } from "@/server/books/queries";
import { getCategoryBySlug } from "@/server/categories/queries";
import { getSeriesBySlug } from "@/server/series/queries";
import { getLessonsByBook } from "@/server/lessons/queries";
import type { Locale } from "@/types/i18n";
import { BookOpen, Layers } from "lucide-react";
import { BookTabs } from "./BookTabs";

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function BookDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const l = locale as Locale;

  const tBook = await getTranslations({ locale, namespace: "book" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tActions = await getTranslations({ locale, namespace: "actions" });
  const tCat = await getTranslations({ locale, namespace: "categories" });

  const book = await getBookBySlug(slug, l);
  if (!book) notFound();

  const [category, lessons] = await Promise.all([
    book.categoryId ? getCategoryBySlug(book.categoryId, l) : null,
    getLessonsByBook(book.id, l),
  ]);
  const series = book.seriesId ? await getSeriesBySlug(book.seriesId, l) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : [{ label: tNav("books"), href: "/kutub" }]),
        { label: book.title },
      ]} />

      {/* Header */}
      <div className="bg-[var(--bg-surface)] dark:bg-[#111C16] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-8 shadow-sm mb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-3 relative aspect-[3/4] rounded-xl overflow-hidden bg-amber-900/10 dark:bg-amber-400/10 flex items-center justify-center shadow-sm max-w-xs mx-auto md:mx-0 w-full">
            <BookOpen className="w-12 h-12 text-amber-800/20 dark:text-amber-400/20" aria-hidden="true" />
          </div>
          <div className="md:col-span-9">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-2">
              {category && (<><Link href={`/categories/${category.slug}`} className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline">{category.name}</Link><span aria-hidden="true">·</span></>)}
              <span>{book.lessonCount ?? 0} {tCat("duruusCount")}</span>
              {book.pdfPages && (<><span aria-hidden="true">·</span><span>{book.pdfPages}p</span></>)}
              {book.pdfSize && (<><span aria-hidden="true">·</span><span>{book.pdfSize}</span></>)}
            </div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-stone-900 dark:text-stone-100 leading-tight mb-1">{book.title}</h1>
            {book.author && <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 italic mb-4">{book.author}</p>}
            {book.description && <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-6">{book.description}</p>}
            <div className="flex flex-wrap items-center gap-3">
              {series && (
                <Link href={`/series/${series.slug}`} className="px-4 py-2.5 rounded-lg bg-emerald-900 text-amber-100 hover:bg-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors">
                  <Layers className="w-4 h-4" aria-hidden="true" />{tBook("goToSeries")} ({series.lessonCount ?? 0} {tCat("duruusCount")})
                </Link>
              )}
              {book.pdfAvailable && (
                <span className="px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-medium text-emerald-800 dark:text-emerald-400">
                  {tBook("pdfAvailable")}{book.pdfSize ? ` · ${book.pdfSize}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <BookTabs
        book={book}
        lessons={lessons}
        tabReaderLabel={tBook("tabReader")}
        tabContentsLabel={`${tBook("tabContents")} (${book.tableOfContents?.length ?? 0})`}
        tabAudioLabel={`${tBook("tabAudio")} (${lessons.length})`}
        chapterLabel={tBook("chapter")}
        tocEmptyLabel={tBook("tocEmpty")}
        lessonsEmptyLabel={tBook("lessonsEmpty")}
        keyChaptersLabel={tBook("keyChapters")}
        listenLabel={tActions("listen")}
        duruusLabel={tCat("duruusCount")}
      />
    </div>
  );
}
