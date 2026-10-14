import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { prisma } from "@/lib/db";

function setMessageValue(
  messages: Record<string, unknown>,
  namespace: string,
  key: string,
  value: string
) {
  const parts = [namespace, ...key.split(".")];
  if (parts.some((part) => ["__proto__", "constructor", "prototype"].includes(part))) return;

  let target = messages;
  for (const part of parts.slice(0, -1)) {
    const child = target[part];
    if (!child || typeof child !== "object" || Array.isArray(child)) {
      target[part] = {};
    }
    target = target[part] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = structuredClone((await import(`./messages/${locale}.json`)).default) as Record<string, unknown>;

  try {
    const content = await prisma.siteContent.findMany({
      select: { namespace: true, key: true, translations: true, isHidden: true },
    });

    for (const item of content) {
      if (item.isHidden) {
        setMessageValue(messages, item.namespace, item.key, "");
        continue;
      }
      const translations = item.translations as Record<string, unknown>;
      const value = translations[locale];
      if (typeof value === "string" && value.length > 0) {
        setMessageValue(messages, item.namespace, item.key, value);
      }
    }
  } catch {
    // Keep the bundled translations available before the content migration is applied.
  }

  return {
    locale,
    messages,
  };
});
