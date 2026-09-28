import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { SearchResults } from "./SearchResults";

/**
 * Search page — Server Component shell.
 * Passes all translated labels to the SearchResults client island.
 *
 * TEMPORARY: Full-text search is stubbed — all queries return empty results.
 * Stage H will wire this to a /api/search Route Handler backed by
 * PostgreSQL full-text search (tsvector/tsquery).
 */

type Props = { params: Promise<{ locale: string }> };

export default async function SearchPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tCat = await getTranslations({ locale, namespace: "categories" });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ label: tNav("search") }]} />

      <SearchResults
        labels={{
          title: t("libraryTitle"),
          placeholder: t("placeholder"),
          searchButton: t("searchButton"),
          allResults: t("allResults"),
          tabLessons: t("tabLessons"),
          tabSeries: t("tabSeries"),
          tabBooks: t("tabBooks"),
          tabDisciplines: t("tabDisciplines"),
          foundMatches: t("foundMatches"),
          noResults: t("noResults"),
          noMatchHint: t("noMatchHint"),
          emptyPrompt: t("emptyPrompt"),
          duruusLabel: tCat("duruusCount"),
        }}
      />
    </div>
  );
}
