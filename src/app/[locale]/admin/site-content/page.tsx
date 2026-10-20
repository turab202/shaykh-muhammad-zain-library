import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import enMessages from "@/i18n/messages/en.json";
import arMessages from "@/i18n/messages/ar.json";
import amMessages from "@/i18n/messages/am.json";
import { deleteSiteContent, saveSiteContent } from "@/server/admin/actions";
import { SiteContentManager } from "./SiteContentManager";
import type { Locale } from "@/types/i18n";

type Entry = {
  namespace: string;
  key: string;
  translations: Record<Locale, string>;
  isHidden: boolean;
  updatedAt: string | null;
};

export default async function SiteContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }

  let overrides: Awaited<ReturnType<typeof prisma.siteContent.findMany>>;
  try {
    overrides = await prisma.siteContent.findMany({ orderBy: [{ namespace: "asc" }, { key: "asc" }] });
  } catch (error) {
    console.error("Unable to load website content. Apply the site-content database migration.", error);
    return (
      <div className="mx-auto max-w-360 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Website Content</h1>
        <div role="alert" className="rounded-r-xl border-s-4 border-amber-500 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          Website content storage is not available yet. Apply the pending database migration with <code className="font-mono">npx prisma migrate deploy</code>, then reload this page.
        </div>
      </div>
    );
  }
  const entries = new Map<string, Entry>();

  for (const [namespace, section] of Object.entries(enMessages)) {
    if (namespace === "admin") continue;
    for (const key of collectStrings(section)) {
      entries.set(`${namespace}.${key}`, {
        namespace,
        key,
        translations: {
          en: readMessage(enMessages, namespace, key),
          ar: readMessage(arMessages, namespace, key),
          am: readMessage(amMessages, namespace, key),
        },
        isHidden: false,
        updatedAt: null,
      });
    }
  }

  for (const item of overrides) {
    if (item.namespace === "admin") continue;
    const id = `${item.namespace}.${item.key}`;
    const existing = entries.get(id);
    const translations = item.translations as Partial<Record<Locale, string>>;
    entries.set(id, {
      namespace: item.namespace,
      key: item.key,
      translations: {
        en: translations.en || existing?.translations.en || "",
        ar: translations.ar || existing?.translations.ar || "",
        am: translations.am || existing?.translations.am || "",
      },
      isHidden: item.isHidden,
      updatedAt: item.updatedAt.toISOString(),
    });
  }

  return (
    <SiteContentManager entries={[...entries.values()]} saveAction={saveSiteContent} hideAction={deleteSiteContent} />
  );
}

function collectStrings(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [path] : collectStrings(child, path);
  });
}

function readMessage(messages: Record<string, unknown>, namespace: string, key: string): string {
  let value: unknown = messages[namespace];
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object") return "";
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : "";
}
