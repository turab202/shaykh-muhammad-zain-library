import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Languages, Plus, Save } from "lucide-react";
import enMessages from "@/i18n/messages/en.json";
import arMessages from "@/i18n/messages/ar.json";
import amMessages from "@/i18n/messages/am.json";
import { deleteSiteContent, saveSiteContent } from "@/server/admin/actions";
import { DeleteButton } from "@/components/admin/DeleteButton";
import type { Locale } from "@/types/i18n";

type Entry = {
  namespace: string;
  key: string;
  translations: Record<Locale, string>;
  isHidden: boolean;
};

export default async function SiteContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }

  const overrides = await prisma.siteContent.findMany({ orderBy: [{ namespace: "asc" }, { key: "asc" }] });
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
    });
  }

  const groups = new Map<string, Entry[]>();
  for (const entry of entries.values()) {
    const group = groups.get(entry.namespace) ?? [];
    group.push(entry);
    groups.set(entry.namespace, group);
  }

  return (
    <div className="max-w-6xl space-y-7">
      <div className="flex items-start gap-3 border-b border-stone-200 dark:border-stone-800 pb-5">
        <Languages className="mt-1 h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Website Content</h1>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">Public pages · English · العربية · አማርኛ</p>
        </div>
      </div>

      <form action={saveSiteContent} className="space-y-4 border-b border-stone-200 dark:border-stone-800 pb-7">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-stone-200">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add text entry
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="namespace" label="Section" placeholder="hero, about, footer" required />
          <Field name="key" label="Text key" placeholder="newHeadline" required />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <TextField id="new-en" name="en" label="English" required />
          <TextField id="new-ar" name="ar" label="Arabic" dir="rtl" />
          <TextField id="new-am" name="am" label="Amharic" />
        </div>
        <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-emerald-900 px-4 py-2 text-xs font-semibold text-amber-100 transition-colors hover:bg-emerald-800">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add entry
        </button>
      </form>

      <div className="space-y-3">
        {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([namespace, items]) => (
          <details key={namespace} className="group border-b border-stone-200 dark:border-stone-800">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3">
              <span className="text-sm font-semibold capitalize text-stone-800 dark:text-stone-200">{namespace.replaceAll("-", " ")}</span>
              <span className="text-xs text-stone-400">{items.length} entries</span>
            </summary>
            <div className="divide-y divide-stone-100 dark:divide-stone-800 pb-3">
              {items.sort((a, b) => a.key.localeCompare(b.key)).map((entry) => (
                <details key={`${entry.namespace}.${entry.key}`} className="py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-stone-700 dark:text-stone-300">{entry.key}</span>
                    {entry.isHidden && <span className="text-[10px] font-semibold uppercase text-red-600 dark:text-red-400">Hidden</span>}
                    <span className="max-w-[45%] truncate text-xs text-stone-400" dir="auto">{entry.translations.en}</span>
                  </summary>
                  <form action={saveSiteContent} className="grid gap-3 pb-3 pt-2 lg:grid-cols-3">
                    <input type="hidden" name="namespace" value={entry.namespace} />
                    <input type="hidden" name="key" value={entry.key} />
                    <TextField id={`${entry.namespace}-${entry.key}-en`} name="en" label="English" defaultValue={entry.translations.en} required />
                    <TextField id={`${entry.namespace}-${entry.key}-ar`} name="ar" label="Arabic" defaultValue={entry.translations.ar} dir="rtl" />
                    <TextField id={`${entry.namespace}-${entry.key}-am`} name="am" label="Amharic" defaultValue={entry.translations.am} />
                    <div className="flex items-center gap-4 lg:col-span-3">
                      <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-emerald-900 px-3 py-2 text-xs font-semibold text-amber-100 transition-colors hover:bg-emerald-800">
                        <Save className="h-3.5 w-3.5" aria-hidden="true" /> Save translations
                      </button>
                      <DeleteButton
                        action={deleteSiteContent.bind(null, entry.namespace, entry.key)}
                        itemName={`${entry.namespace}.${entry.key}`}
                        itemType="website text"
                      />
                    </div>
                  </form>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
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

function Field({ name, label, placeholder, required }: { name: string; label: string; placeholder: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">{label}</label>
      <input id={name} name={name} placeholder={placeholder} required={required} className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100" />
    </div>
  );
}

function TextField({ id, name, label, defaultValue, dir, required }: { id: string; name: string; label: string; defaultValue?: string; dir?: "rtl"; required?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">{label}</label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        dir={dir}
        required={required}
        rows={3}
        className="w-full resize-y rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
      />
    </div>
  );
}