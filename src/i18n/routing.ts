import { defineRouting } from "next-intl/routing";
import type { Locale } from "@/types/i18n";

export const routing = defineRouting({
  locales: ["en", "ar", "am"] satisfies Locale[],
  defaultLocale: "en" satisfies Locale,
  // Locale prefix strategy: always show locale in URL
  // e.g. /en/duruus, /ar/duruus, /am/duruus
  localePrefix: "always",
});
