import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("site");

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold text-center">{t("name")}</h1>
      <p className="mt-4 text-zinc-600 text-center max-w-md">
        {t("description")}
      </p>
    </main>
  );
}
