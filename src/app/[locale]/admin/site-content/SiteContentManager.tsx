"use client";

import { useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  Folder,
  Globe2,
  Languages,
  Pencil,
  Search,
  SlidersHorizontal,
  Save,
  X,
} from "lucide-react";
import { CreateDialog } from "@/components/admin/CreateDialog";
import type { Locale } from "@/types/i18n";

type Entry = {
  namespace: string;
  key: string;
  translations: Record<Locale, string>;
  isHidden: boolean;
  updatedAt: string | null;
};

type SaveAction = (formData: FormData) => Promise<void>;
type HideAction = (namespace: string, key: string) => Promise<void>;

const locales: { id: Locale; label: string; shortLabel: string }[] = [
  { id: "en", label: "English", shortLabel: "EN" },
  { id: "ar", label: "Arabic", shortLabel: "العربية" },
  { id: "am", label: "Amharic", shortLabel: "አማርኛ" },
];

const pageSize = 12;

export function SiteContentManager({
  entries,
  saveAction,
  hideAction,
}: {
  entries: Entry[];
  saveAction: SaveAction;
  hideAction: HideAction;
}) {
  const [search, setSearch] = useState("");
  const [namespace, setNamespace] = useState("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [selectedKey, setSelectedKey] = useState<string | null>(entries[0] ? entryId(entries[0]) : null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const groups = [...new Set(entries.map((entry) => entry.namespace))].sort((a, b) => a.localeCompare(b));
  const filteredEntries = entries.filter((entry) => {
    if (namespace !== "all" && entry.namespace !== namespace) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [entry.key, entry.namespace, ...Object.values(entry.translations)].some((value) => value.toLowerCase().includes(query));
  });
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = selectedKey === null ? null : filteredEntries.find((entry) => entryId(entry) === selectedKey) ?? filteredEntries[0] ?? null;
  const reviewCount = entries.filter((entry) => !entry.isHidden && locales.some(({ id }) => !entry.translations[id].trim())).length;
  const selectedOnPage = pageEntries.filter((entry) => selectedRows.has(entryId(entry)));
  const allPageSelected = pageEntries.length > 0 && selectedOnPage.length === pageEntries.length;

  function togglePageSelection(checked: boolean) {
    setSelectedRows((current) => {
      const next = new Set(current);
      for (const entry of pageEntries) {
        if (checked) next.add(entryId(entry));
        else next.delete(entryId(entry));
      }
      return next;
    });
  }

  function toggleRowSelection(id: string, checked: boolean) {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function hideSelected() {
    const rows = entries.filter((entry) => selectedRows.has(entryId(entry)) && !entry.isHidden);
    if (!rows.length) return;
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        for (const entry of rows) await hideAction(entry.namespace, entry.key);
        setSelectedRows(new Set());
        setNotice(`${rows.length} ${rows.length === 1 ? "entry" : "entries"} hidden.`);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to hide selected entries.");
      }
    });
  }

  function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        await saveAction(formData);
        setNotice("Translations saved.");
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to save translations.");
      }
    });
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Languages className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Website Content</h1>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">Manage public pages and translations across languages</p>
          </div>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-950 sm:inline-flex dark:text-emerald-300 dark:hover:text-emerald-100">
          <Globe2 className="size-3.5" aria-hidden="true" /> Public site <span aria-hidden="true">↗</span>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Summary label="Translation entries" value={entries.length} icon={Languages} tone="green" />
        <Summary label="Content groups" value={groups.length} icon={Folder} tone="green" />
        <Summary label="Languages" value={locales.length} icon={Globe2} tone="green" />
        <Summary label="Needing review" value={reviewCount} icon={AlertTriangle} tone="amber" />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
        <section className="min-w-0 space-y-4" aria-label="Translation entries">
          <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
              <span className="sr-only">Search translation entries</span>
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search translation keys or content..." className="min-h-12 w-full rounded-xl border border-stone-200 bg-stone-50 ps-10 pe-4 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100" />
              </label>
              <button type="button" aria-label="Filter translations" aria-expanded={mobileFiltersOpen} aria-controls="translation-mobile-filters" onClick={() => setMobileFiltersOpen((open) => !open)} className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 lg:hidden ${mobileFiltersOpen || namespace !== "all" ? "border-emerald-800 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-stone-200 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"}`}>
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {namespace !== "all" && <span className="absolute -end-1 -top-1 size-2.5 rounded-full bg-emerald-700 ring-2 ring-white dark:ring-stone-900" />}
              </button>
            </div>
            <div id="translation-mobile-filters" className={`${mobileFiltersOpen ? "flex" : "hidden"} flex-wrap items-center gap-2 lg:flex`} aria-label="Translation filters">
            <div className="flex flex-wrap items-center gap-1" aria-label="Translation status language">
              {locales.map(({ id, label, shortLabel }) => (
                <button key={id} type="button" aria-pressed={activeLocale === id} onClick={() => setActiveLocale(id)} className={`min-h-11 min-w-12 rounded-lg px-3 text-sm font-semibold transition-colors ${activeLocale === id ? "bg-emerald-800 text-white dark:bg-emerald-700" : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"}`} title={`${label} status`}>
                  {shortLabel}
                </button>
              ))}
            </div>
            <label className="relative">
              <span className="sr-only">Filter by group</span>
              <select value={namespace} onChange={(event) => { setNamespace(event.target.value); setPage(1); }} className="min-h-11 min-w-40 appearance-none rounded-lg border border-stone-200 bg-white ps-3 pe-8 text-sm text-stone-700 outline-none focus:border-emerald-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
                <option value="all">All groups</option>
                {groups.map((group) => <option key={group} value={group}>{groupLabel(group)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute inset-e-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            </label>
            </div>
            <CreateDialog title="Add text entry" submitLabel="Add entry" action={saveAction}>
              <div className="grid gap-3 sm:grid-cols-2">
                <NewField name="namespace" label="Group" placeholder="hero, about, footer" required />
                <NewField name="key" label="Translation key" placeholder="newHeadline" required />
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <NewTextField id="new-en" name="en" label="English" required />
                <NewTextField id="new-ar" name="ar" label="Arabic" dir="rtl" />
                <NewTextField id="new-am" name="am" label="Amharic" />
              </div>
            </CreateDialog>
          </div>

          {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-xs ${error ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>{error || notice}</p>}

          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 border-collapse text-left text-sm">
                <thead className="bg-stone-50 dark:bg-stone-950/60">
                  <tr className="border-b border-stone-200 dark:border-stone-800">
                    <th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Select all entries on this page" checked={allPageSelected} onChange={(event) => togglePageSelection(event.target.checked)} className="size-4 accent-emerald-800" /></th>
                    <ColumnHeading>Key</ColumnHeading>
                    <ColumnHeading>Group</ColumnHeading>
                    <ColumnHeading>English preview</ColumnHeading>
                    <ColumnHeading>Arabic preview</ColumnHeading>
                    <ColumnHeading>Status</ColumnHeading>
                    <ColumnHeading>Updated</ColumnHeading>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {pageEntries.map((entry) => {
                    const id = entryId(entry);
                    const active = selected && entryId(selected) === id;
                    return (
                      <tr key={id} onClick={() => setSelectedKey(id)} className={`cursor-pointer transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 ${active ? "bg-emerald-50/60 dark:bg-emerald-950/25" : ""}`}>
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${entry.key}`} checked={selectedRows.has(id)} onChange={(event) => toggleRowSelection(id, event.target.checked)} className="size-4 accent-emerald-800" /></td>
                        <td className="max-w-40 truncate px-4 py-3 font-mono text-xs font-semibold text-stone-700 dark:text-stone-200">{entry.key}</td>
                        <td className="px-4 py-3"><span className={groupBadgeClass(entry.namespace)}>{groupLabel(entry.namespace)}</span></td>
                        <td className="max-w-56 truncate px-4 py-3 text-sm text-stone-600 dark:text-stone-300" dir="auto">{entry.translations.en || <span className="text-stone-400">Not translated</span>}</td>
                        <td className="max-w-52 truncate px-4 py-3 text-sm text-stone-600 dark:text-stone-300" dir="rtl">{entry.translations.ar || <span className="text-stone-400">Not translated</span>}</td>
                        <td className="px-4 py-3"><Status entry={entry} locale={activeLocale} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500 dark:text-stone-400">{formatDate(entry.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button type="button" aria-label={`Edit ${entry.key}`} title="Edit translation" onClick={(event) => { event.stopPropagation(); setSelectedKey(id); }} className="min-h-10 rounded-lg px-3 py-2 text-xs font-medium text-stone-600 hover:bg-white hover:text-emerald-800 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-emerald-300">Edit</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pageEntries.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-stone-500">No translation entries match your filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 dark:border-stone-800">
              <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                <span>{selectedRows.size} selected</span>
                {selectedRows.size > 0 && <button type="button" disabled={isPending} onClick={hideSelected} className="rounded border border-stone-200 px-2 py-1 font-medium text-stone-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:text-red-300">Hide selected</button>}
              </div>
              <div className="flex items-center gap-1" aria-label="Pagination">
                <span className="me-2 text-xs text-stone-500">{filteredEntries.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredEntries.length)} of ${filteredEntries.length}` : "0 entries"}</span>
                <PageButton label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-3.5" aria-hidden="true" /></PageButton>
                <span className="min-w-10 rounded-lg bg-emerald-800 px-3 py-2 text-center text-sm font-semibold text-white">{currentPage}</span>
                <span className="px-1 text-xs text-stone-500">of {pageCount}</span>
                <PageButton label="Next page" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-3.5" aria-hidden="true" /></PageButton>
              </div>
            </div>
          </div>
        </section>

        <aside className="min-w-0 rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 lg:sticky lg:top-4 lg:self-start">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4 dark:border-stone-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-stone-100"><Pencil className="size-4 text-emerald-800 dark:text-emerald-300" aria-hidden="true" /> Edit translation entry</div>
                <button type="button" onClick={() => setSelectedKey(null)} aria-label="Close editor" title="Close editor" className="inline-flex size-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"><X className="size-4" aria-hidden="true" /></button>
              </div>
              <form key={entryId(selected)} onSubmit={saveEntry} className="space-y-4 p-4">
                <input type="hidden" name="namespace" value={selected.namespace} />
                <input type="hidden" name="key" value={selected.key} />
                <div>
                  <label htmlFor="edit-key" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700 dark:text-stone-300"><FileText className="size-4" aria-hidden="true" /> Translation key</label>
                  <input id="edit-key" value={selected.key} readOnly className="min-h-11 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700 outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200" />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700 dark:text-stone-300"><Folder className="size-4" aria-hidden="true" /> Group</label>
                  <div className="flex h-9 items-center"><span className={groupBadgeClass(selected.namespace)}>{groupLabel(selected.namespace)}</span></div>
                </div>
                <div className="border-t border-stone-200 dark:border-stone-800" />
                <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100">Translations</h2><span className="text-xs text-stone-500">{locales.length} languages</span></div>
                <EditorField id="edit-en" name="en" label="English" value={selected.translations.en} maxLength={500} />
                <EditorField id="edit-ar" name="ar" label="Arabic (العربية)" value={selected.translations.ar} dir="rtl" maxLength={500} />
                <EditorField id="edit-am" name="am" label="Amharic (አማርኛ)" value={selected.translations.am} maxLength={500} />
                <div className="flex gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs leading-relaxed text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"><CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> This entry will be updated for all languages.</div>
                <button type="submit" disabled={isPending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:opacity-60 dark:bg-emerald-700 dark:hover:bg-emerald-600"><Save className="size-4" aria-hidden="true" /> {isPending ? "Saving..." : "Save changes"}</button>
                <button type="button" onClick={() => setSelectedKey(null)} className="min-h-11 w-full rounded-lg border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">Cancel</button>
              </form>
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"><Languages className="size-5" aria-hidden="true" /></div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Select a translation</p>
              <p className="text-sm leading-relaxed text-stone-500">Choose an entry from the table to edit its translations.</p>
              <button type="button" onClick={() => setSelectedKey(filteredEntries[0] ? entryId(filteredEntries[0]) : null)} disabled={!filteredEntries.length} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 hover:underline disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40">Open first entry <ChevronRight className="size-4" aria-hidden="true" /></button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Summary({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Languages; tone: "green" | "amber" }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-4 dark:border-stone-800 dark:bg-stone-900"><div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone === "amber" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"}`}><Icon className="size-5" aria-hidden="true" /></div><div className="min-w-0"><div className="text-lg font-bold leading-none text-stone-900 dark:text-stone-100">{value}</div><div className="mt-1.5 truncate text-xs font-medium text-stone-600 dark:text-stone-400">{label}</div></div></div>;
}

function ColumnHeading({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">{children}</th>;
}

function Status({ entry, locale }: { entry: Entry; locale: Locale }) {
  const missing = !entry.translations[locale].trim();
  const label = entry.isHidden ? "Hidden" : missing ? "Needs review" : "Published";
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${entry.isHidden ? "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300" : missing ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200" : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"}`}>{label}</span>;
}

function EditorField({ id, name, label, value, dir, maxLength }: { id: string; name: Locale; label: string; value: string; dir?: "rtl"; maxLength: number }) {
  const [text, setText] = useState(value);
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-stone-700 dark:text-stone-300">{label}</label><textarea id={id} name={name} value={text} onChange={(event) => setText(event.target.value)} dir={dir} maxLength={maxLength} rows={3} required={name === "en"} className="w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-stone-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100" /><div className="mt-1 text-end text-xs text-stone-500">{text.length}/{maxLength}</div></div>;
}

function NewField({ name, label, placeholder, required }: { name: string; label: string; placeholder: string; required?: boolean }) {
  return <div><label htmlFor={name} className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">{label}</label><input id={name} name={name} placeholder={placeholder} required={required} className="min-h-11 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100" /></div>;
}

function NewTextField({ id, name, label, dir, required }: { id: string; name: Locale; label: string; dir?: "rtl"; required?: boolean }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">{label}</label><textarea id={id} name={name} dir={dir} required={required} maxLength={10000} rows={3} className="w-full resize-y rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm leading-relaxed text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100" /></div>;
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="inline-flex size-10 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">{children}</button>;
}

function entryId(entry: Entry) {
  return `${entry.namespace}.${entry.key}`;
}

function groupLabel(group: string) {
  return group.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupBadgeClass(group: string) {
  const palette = [
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
    "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
    "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
    "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
    "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  ];
  const hash = [...group].reduce((value, character) => value + character.charCodeAt(0), 0);
  return `whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${palette[hash % palette.length]}`;
}

function formatDate(value: string | null) {
  if (!value) return "Source";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}