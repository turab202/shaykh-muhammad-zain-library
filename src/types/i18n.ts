/**
 * Represents a piece of text that may have translations in the three
 * supported locales. A field may have none, some, or all locales present.
 *
 * DO NOT fabricate translations — if a value is absent, leave it undefined.
 * The application will fall back to the default (usually English or original).
 */
export type LocalizedText = {
  en?: string;
  ar?: string;
  am?: string;
};

/**
 * The three supported locales.
 */
export type Locale = "en" | "ar" | "am";

/**
 * Ordered list of supported locales.
 */
export const LOCALES: Locale[] = ["en", "ar", "am"] as const;

/**
 * The default locale used when no preferred locale is detected.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Locales that use right-to-left text direction.
 */
export const RTL_LOCALES: Locale[] = ["ar"] as const;

/**
 * Returns true if the given locale uses RTL text direction.
 */
export function isRtlLocale(locale: Locale): boolean {
  return (RTL_LOCALES as Locale[]).includes(locale);
}

/**
 * Resolve a LocalizedText value for a given locale, with English fallback,
 * then any non-empty value as a last resort.
 * Returns undefined only if all translations are missing.
 */
export function resolveLocalized(
  text: LocalizedText | null | undefined,
  locale: Locale
): string | undefined {
  if (!text) return undefined;
  return text[locale] ?? text.en ?? text.am ?? text.ar;
}
