import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CategoryCard } from "@/components/cards/CategoryCard";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { CATALOG_CATEGORIES } from "@/lib/fixtures/catalog";

// TEMPORARY — replace with: prisma.category.findMany({ orderBy: { name: 'asc' } })

type Props = { params: Promise<{ locale: string }> };

export default async function CategoriesPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tCat = await getTranslations({ locale, namespace: "categories" });

  const categories = CATALOG_CATEGORIES;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ label: tNav("categories") }]} />

      {/* Page header */}
      <div className="pb-6 border-b border-stone-200 dark:border-stone-800 mb-8">
        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
          {t("disciplinesEyebrow")}
        </span>
        <h1 className="font-serif font-bold text-3xl sm:text-4xl text-stone-900 dark:text-stone-100 mt-1">
          {t("disciplines")}
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-2 max-w-2xl leading-relaxed">
          {tCat("subtitle")}
        </p>
      </div>

      {/* Grid */}
      {categories.length === 0 ? (
        <p className="text-sm text-stone-500">{t("noResults")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      )}
    </div>
  );
}
