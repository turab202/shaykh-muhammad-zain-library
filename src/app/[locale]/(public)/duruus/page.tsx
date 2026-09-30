import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { DuruusFilter } from "./DuruusFilter";
import { getPublishedLessons } from "@/server/lessons/queries";
import { getPublishedCategories } from "@/server/categories/queries";
import { getPublishedSeries } from "@/server/series/queries";
import type { Locale } from "@/types/i18n";

type Props = { params: Promise<{ locale: string }> };

export default async function DuruusPage({ params }: Props) {
  const { locale } = await params;
  const tCatalog = await getTranslations({ locale, namespace: "catalog" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tActions = await getTranslations({ locale, namespace: "actions" });
  const tCat = await getTranslations({ locale, namespace: "categories" });
  const tSeries = await getTranslations({ locale, namespace: "series" });

  const [lessons, categories, seriesList] = await Promise.all([
    getPublishedLessons(locale as Locale),
    getPublishedCategories(locale as Locale),
    getPublishedSeries(locale as Locale),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ label: tNav("lessons") }]} />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-stone-200 dark:border-stone-800 mb-8">
        <div>
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
            {tCatalog("duruusEyebrow")}
          </span>
          <h1 className="font-serif font-bold text-3xl sm:text-4xl text-stone-900 dark:text-stone-100 mt-1">
            {tCatalog("duruusTitle")}
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-2 max-w-2xl leading-relaxed">
            {tCatalog("duruusSubtitle")}
          </p>
        </div>
      </div>

      <DuruusFilter
        lessons={lessons}
        categories={categories}
        seriesList={seriesList}
        labels={{
          searchPlaceholder: tCatalog("searchSeries"),
          allCategories: tCatalog("allCategories"),
          allSeries: tCatalog("allSeries"),
          sortLessonNumber: tCatalog("sortLessonNumber"),
          sortNewest: tCatalog("sortNewest"),
          sortOldest: tCatalog("sortOldest"),
          sortTitle: tCatalog("sortTitle"),
          viewBySeries: tCatalog("viewBySeries"),
          viewGrid: tCatalog("viewGrid"),
          viewList: tCatalog("viewList"),
          clearFilters: tActions("clearFilters"),
          noResults: tCatalog("noResults"),
          noResultsHint: tCatalog("noLessonsHint"),
          showingPrefix: tCatalog("showingN").replace("{count}", ""),
          exploreDiscipline: tCatalog("exploreDiscipline"),
          disciplineContextHint: tCatalog("disciplineContextHint"),
          seriesCollection: tSeries("seriesAndCollections"),
          duruusLabel: tCat("duruusCount"),
          bookAvailableLabel: tSeries("bookAvailable"),
          listenLabel: tActions("listen"),
          exploreLabel: tSeries("exploreSeries"),
        }}
      />
    </div>
  );
}
