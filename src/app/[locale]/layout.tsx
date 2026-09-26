import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { isRtlLocale } from "@/types/i18n";
import type { Locale } from "@/types/i18n";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { AudioProvider } from "@/lib/context/AudioContext";
import "@/app/globals.css";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "site" });
  return {
    title: {
      default: t("name"),
      template: `%s — ${t("name")}`,
    },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const dir = isRtlLocale(locale as Locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className="h-full">
      <body className="min-h-full flex flex-col antialiased bg-[var(--bg-parchment)] text-[var(--text-primary)] transition-colors duration-200">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AudioProvider>
              {children}
            </AudioProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
