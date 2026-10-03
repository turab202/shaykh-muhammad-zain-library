import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { BookOpen, Send, ShieldCheck, HeartHandshake, Globe } from "lucide-react";

type Props = { params: Promise<{ locale: string }> };

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ label: tNav("about") }]} />

      {/* Title banner */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-8 mb-10 text-center">
        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase">
          {t("eyebrow")}
        </span>
        <h1 className="font-serif font-bold text-3xl sm:text-5xl text-stone-900 dark:text-stone-100 mt-2 mb-4">
          {t("title")}
        </h1>
        {/* Arabic title — always shown as the library's identity */}
        <p className="text-xl sm:text-2xl text-emerald-950 dark:text-emerald-200 font-bold mb-4">
          {t("arabicTitle")}
        </p>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
          {t("subtitle")}
        </p>
      </div>

      {/* Section 1: The Scholar */}
      <section className="mb-12">
        <h2 className="font-serif font-bold text-2xl text-stone-900 dark:text-stone-100 mb-4 pb-2 border-b border-stone-200 dark:border-stone-800">
          {t("scholarTitle")}
        </h2>
        <div className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed space-y-4">
          <p>{t("scholarBody1")}</p>
          <p>{t("scholarBody2")}</p>
        </div>
      </section>

      {/* Section 2: Telegram Archive */}
      <section className="mb-12 bg-[var(--bg-surface-elevated)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Send className="w-4 h-4" aria-hidden="true" />
          <span>{t("telegramEyebrow")}</span>
        </div>
        <h3 className="font-serif font-bold text-xl sm:text-2xl text-stone-900 dark:text-stone-100 mb-4">
          {t("telegramTitle")}
        </h3>
        <div className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed space-y-3">
          <p>{t("telegramBody1")}</p>
          <p>{t("telegramBody2")}</p>
          <ul className="list-disc ps-5 space-y-2 mt-2">
            <li>{t("telegramBullet1")}</li>
            <li>{t("telegramBullet2")}</li>
            <li>{t("telegramBullet3")}</li>
            <li>{t("telegramBullet4")}</li>
          </ul>
        </div>
      </section>

      {/* Section 3: Principles */}
      <section className="mb-12">
        <h2 className="font-serif font-bold text-2xl text-stone-900 dark:text-stone-100 mb-6 pb-2 border-b border-stone-200 dark:border-stone-800">
          {t("principlesTitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { Icon: ShieldCheck, titleKey: "principle1Title" as const, bodyKey: "principle1Body" as const },
            { Icon: HeartHandshake, titleKey: "principle2Title" as const, bodyKey: "principle2Body" as const },
            { Icon: Globe, titleKey: "principle3Title" as const, bodyKey: "principle3Body" as const },
          ].map(({ Icon, titleKey, bodyKey }) => (
            <div
              key={titleKey}
              className="p-5 bg-[var(--bg-surface-elevated)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-xl"
            >
              <Icon className="w-6 h-6 text-emerald-800 dark:text-emerald-400 mb-3" aria-hidden="true" />
              <h4 className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100 mb-2">
                {t(titleKey)}
              </h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                {t(bodyKey)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
