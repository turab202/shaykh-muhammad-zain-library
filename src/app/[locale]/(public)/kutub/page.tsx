import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { BooksFilter } from "./BooksFilter";
import { CATALOG_BOOKS, CATALOG_CATEGORIES } from "@/lib/fixtures/catalog";

// TEMPORARY — replace with Prisma queries

type Props = { params: Promise<{ locale: string }> };

export default async function KutubPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tCat = await getTranslations({ locale, namespace: "categories" });
  const tBook = await getTranslations({ locale, namespace: "book" });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ label: tNav("books") }]} />

      <div className="pb-6 border-b border-stone-200 dark:border-stone-800 mb-8">
        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
          {t("booksEyebrow")}
        </span>
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-stone-900 dark:text-stone-100 mt-1">
          {t("booksTitle")}
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-2 max-w-2xl leading-relaxed">
          {t("booksSubtitle")}
        </p>
      </div>

      <BooksFilter
        books={CATALOG_BOOKS}
        categories={CATALOG_CATEGORIES}
        duruusLabel={tCat("duruusCount")}
        pdfLabel={tBook("pdfAvailable")}
        allCategoriesLabel={t("allCategories")}
        searchPlaceholder={t("searchBooks")}
        noResultsLabel={t("noResults")}
      />
    </div>
  );
}
