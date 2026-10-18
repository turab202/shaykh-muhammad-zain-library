"use client";

import { useState, useTransition } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Link } from "@/i18n/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Grid2X2,
  List,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { CreateDialog } from "@/components/admin/CreateDialog";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { EditBookButton } from "@/components/admin/EditBookButton";
import { UploadPdfButton } from "@/components/admin/UploadPdfButton";
import { ToggleVisibilityButton } from "@/components/admin/ToggleVisibilityButton";
import { UploadCoverButton } from "@/components/admin/UploadCoverButton";

type Category = { id: string; name: string };

type BookEntry = {
  id: string;
  slug: string;
  title: string;
  translations: Record<string, string>;
  author: string | null;
  authorTranslations: Record<string, string>;
  description: string | null;
  descTranslations: Record<string, string>;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  lessons: number;
  coverUrl: string | null;
  hasPdf: boolean;
  createdAt: string;
};

type SortOption = "newest" | "oldest" | "title-asc" | "title-desc";
type StatusFilter = "all" | "PUBLISHED" | "DRAFT" | "ARCHIVED";
type ViewMode = "list" | "grid";

const pageSize = 8;

export function BooksManagement({
  books,
  categories,
  createAction,
  deleteAction,
  visibilityAction,
}: {
  books: BookEntry[];
  categories: Category[];
  createAction: (formData: FormData) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
  visibilityAction: (id: string, status: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [view, setView] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const stats = {
    total: books.length,
    published: books.filter((book) => book.status === "PUBLISHED").length,
    draft: books.filter((book) => book.status === "DRAFT").length,
    hidden: books.filter((book) => book.status === "ARCHIVED").length,
  };
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredBooks = books
    .filter((book) => categoryId === "all" || book.categoryId === categoryId)
    .filter((book) => status === "all" || book.status === status)
    .filter((book) => {
      if (!normalizedQuery) return true;
      return [
        book.title,
        book.author ?? "",
        book.categoryName ?? "",
        ...Object.values(book.translations),
        ...Object.values(book.authorTranslations),
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => compareBooks(a, b, sort));

  const pageCount = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleBooks = filteredBooks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedOnPage = visibleBooks.filter((book) => selectedIds.has(book.id));
  const allPageSelected = visibleBooks.length > 0 && selectedOnPage.length === visibleBooks.length;

  function updateFilter<T extends string>(setter: Dispatch<SetStateAction<T>>, value: T) {
    setter(value);
    setPage(1);
  }

  function togglePageSelection(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const book of visibleBooks) {
        if (checked) next.add(book.id);
        else next.delete(book.id);
      }
      return next;
    });
  }

  function toggleBookSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function updateSelectedStatus(nextStatus: "PUBLISHED" | "DRAFT") {
    const selected = books.filter((book) => selectedIds.has(book.id));
    if (!selected.length) return;
    setNotice("");
    setError("");
    startTransition(async () => {
      try {
        for (const book of selected) await visibilityAction(book.id, nextStatus);
        setNotice(`${selected.length} ${selected.length === 1 ? "book" : "books"} updated.`);
        setSelectedIds(new Set());
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to update selected books.");
      }
    });
  }

  const rangeStart = filteredBooks.length ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(currentPage * pageSize, filteredBooks.length);

  return (
    <div className="mx-auto min-w-0 max-w-360 space-y-4">
      <section className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Books Management</h1>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">Manage books in the catalog · {books.length} books</p>
        </div>
        <CreateDialog
          title="Add Book"
          submitLabel="Create book"
          action={createAction}
          triggerClassName="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-900 active:bg-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 sm:w-auto"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField name="slug" label="Slug" required />
            <FormField name="title" label="English Title" required />
            <FormField name="arTitle" label="Arabic Title" dir="rtl" />
            <FormField name="amTitle" label="Amharic Title" />
            <FormField name="author" label="Author (English)" />
            <FormField name="arAuthor" label="Author (Arabic)" dir="rtl" />
            <SelectField id="new-book-category" name="categoryId" label="Category" defaultValue="">
              <option value="">None</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </SelectField>
            <SelectField id="new-book-status" name="status" label="Status" defaultValue="DRAFT">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </SelectField>
          </div>
        </CreateDialog>
      </section>

      <section aria-label="Book statistics" className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Total Books" value={stats.total} icon={BookOpen} tone="green" />
        <StatCard label="Published" value={stats.published} icon={FileText} tone="green" />
        <StatCard label="Draft" value={stats.draft} icon={Clock3} tone="blue" />
        <StatCard label="Hidden" value={stats.hidden} icon={EyeOff} tone="red" />
      </section>

      <section aria-label="Search and filters" className="space-y-2.5">
        <label className="relative block">
          <Search className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <span className="sr-only">Search books</span>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search book title, author, or category..."
            className="h-10 w-full rounded-md border border-stone-200 bg-white ps-9 pe-3 text-xs text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <FilterSelect label="Category" value={categoryId} onChange={(value) => updateFilter(setCategoryId, value)}>
            <option value="all">All Categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Status" value={status} onChange={(value) => updateFilter(setStatus, value as StatusFilter)}>
            <option value="all">All Status</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Hidden</option>
          </FilterSelect>
          <FilterSelect label="Sort books" value={sort} onChange={(value) => updateFilter(setSort, value as SortOption)}>
            <option value="newest">Sort by: Newest</option>
            <option value="oldest">Sort by: Oldest</option>
            <option value="title-asc">Title: A to Z</option>
            <option value="title-desc">Title: Z to A</option>
          </FilterSelect>
          <div className="col-span-2 hidden items-center justify-end gap-1 sm:col-span-1 sm:ms-auto lg:flex">
            <ViewButton label="Grid view" selected={view === "grid"} onClick={() => setView("grid")}><Grid2X2 className="size-4" aria-hidden="true" /></ViewButton>
            <ViewButton label="List view" selected={view === "list"} onClick={() => setView("list")}><List className="size-4" aria-hidden="true" /></ViewButton>
          </div>
        </div>
      </section>

      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-xs ${error ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>{error || notice}</p>}

      {view === "list" ? (
        <div className="hidden overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 lg:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-235 border-collapse text-left">
              <thead className="bg-stone-50 dark:bg-stone-950/50">
                <tr className="border-b border-stone-200 dark:border-stone-800">
                  <th className="w-9 px-3 py-2.5"><input type="checkbox" aria-label="Select books on this page" checked={allPageSelected} onChange={(event) => togglePageSelection(event.target.checked)} className="size-3.5 accent-emerald-800" /></th>
                  <Heading>Cover</Heading>
                  <Heading>Title</Heading>
                  <Heading>Author</Heading>
                  <Heading>Category</Heading>
                  <Heading>Lessons</Heading>
                  <Heading>Status</Heading>
                  <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wide text-stone-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {visibleBooks.map((book) => (
                  <tr key={book.id} className="transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-800/30">
                    <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Select ${book.title}`} checked={selectedIds.has(book.id)} onChange={(event) => toggleBookSelection(book.id, event.target.checked)} className="size-3.5 accent-emerald-800" /></td>
                    <td className="px-3 py-2"><CoverThumb book={book} size="table" /></td>
                    <td className="max-w-64 px-3 py-2.5"><div className="truncate text-[11px] font-semibold text-stone-800 dark:text-stone-100" title={book.title}>{book.title}</div>{book.translations.ar && <div className="mt-0.5 truncate text-[10px] text-stone-500 dark:text-stone-400" dir="rtl" title={book.translations.ar}>{book.translations.ar}</div>}</td>
                    <td className="max-w-40 truncate px-3 py-2.5 text-[10px] text-stone-500 dark:text-stone-400" title={book.author ?? undefined}>{book.author || "—"}</td>
                    <td className="px-3 py-2.5"><CategoryBadge name={book.categoryName} id={book.categoryId} /></td>
                    <td className="px-3 py-2.5 text-center text-[10px] tabular-nums text-stone-600 dark:text-stone-300">{book.lessons}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={book.status} /></td>
                    <td className="px-3 py-2.5"><BookActions book={book} categories={categories} deleteAction={deleteAction} visibilityAction={visibilityAction} /></td>
                  </tr>
                ))}
                {visibleBooks.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-stone-500">No books match your search or filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <Footer
            start={rangeStart}
            end={rangeEnd}
            total={filteredBooks.length}
            page={currentPage}
            pages={pageCount}
            selected={selectedIds.size}
            disabled={isPending}
            onPage={setPage}
            onClear={() => setSelectedIds(new Set())}
            onPublish={() => updateSelectedStatus("PUBLISHED")}
            onDraft={() => updateSelectedStatus("DRAFT")}
          />
        </div>
      ) : (
        <div className="hidden lg:block">
          {visibleBooks.length ? <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">{visibleBooks.map((book) => <BookGridCard key={book.id} book={book} categories={categories} deleteAction={deleteAction} visibilityAction={visibilityAction} selected={selectedIds.has(book.id)} onSelect={(checked) => toggleBookSelection(book.id, checked)} />)}</div> : <EmptyState />}
          <Footer
            start={rangeStart}
            end={rangeEnd}
            total={filteredBooks.length}
            page={currentPage}
            pages={pageCount}
            selected={selectedIds.size}
            disabled={isPending}
            onPage={setPage}
            onClear={() => setSelectedIds(new Set())}
            onPublish={() => updateSelectedStatus("PUBLISHED")}
            onDraft={() => updateSelectedStatus("DRAFT")}
          />
        </div>
      )}

      <div className="space-y-2.5 lg:hidden">
        {visibleBooks.length ? visibleBooks.map((book) => (
          <article key={book.id} className="relative flex gap-3 rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
            <input type="checkbox" aria-label={`Select ${book.title}`} checked={selectedIds.has(book.id)} onChange={(event) => toggleBookSelection(book.id, event.target.checked)} className="absolute inset-s-2 top-2 size-4 accent-emerald-800" />
            <div className="shrink-0 ps-5"><CoverThumb book={book} size="card" /></div>
            <div className="min-w-0 flex-1 pe-10">
              <h2 className="line-clamp-2 text-xs font-semibold leading-snug text-stone-800 dark:text-stone-100" title={book.title}>{book.title}</h2>
              {book.translations.ar && <p dir="rtl" className="mt-1 line-clamp-1 text-[10px] text-stone-500 dark:text-stone-400">{book.translations.ar}</p>}
              <p className="mt-1 truncate text-[10px] text-stone-500 dark:text-stone-400" title={book.author ?? undefined}>{book.author || "Unknown author"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <CategoryBadge name={book.categoryName} id={book.categoryId} />
                <span className="inline-flex items-center gap-1 text-[9px] text-stone-500 dark:text-stone-400"><FileText className="size-3" aria-hidden="true" />{book.lessons}</span>
                <StatusBadge status={book.status} />
              </div>
            </div>
            <BookActionMenu book={book} categories={categories} deleteAction={deleteAction} visibilityAction={visibilityAction} mobile />
          </article>
        )) : <EmptyState />}
        <Footer
          start={rangeStart}
          end={rangeEnd}
          total={filteredBooks.length}
          page={currentPage}
          pages={pageCount}
          selected={selectedIds.size}
          disabled={isPending}
          onPage={setPage}
          onClear={() => setSelectedIds(new Set())}
          onPublish={() => updateSelectedStatus("PUBLISHED")}
          onDraft={() => updateSelectedStatus("DRAFT")}
          mobile
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof BookOpen; tone: "green" | "blue" | "red" }) {
  const colors = {
    green: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  };
  return <div className="flex min-w-0 items-center gap-2.5 rounded-md border border-stone-200 bg-white px-3 py-3 dark:border-stone-800 dark:bg-stone-900 sm:gap-3 sm:px-4"><div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${colors[tone]}`}><Icon className="size-4" aria-hidden="true" /></div><div className="min-w-0"><p className="text-sm font-bold leading-none tabular-nums text-stone-800 dark:text-stone-100">{value}</p><p className="mt-1 truncate text-[9px] text-stone-500 dark:text-stone-400 sm:text-[10px]">{label}</p></div></div>;
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="relative min-w-0 sm:min-w-36"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full appearance-none rounded-md border border-stone-200 bg-white ps-3 pe-8 text-[10px] text-stone-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">{children}</select><ChevronDown className="pointer-events-none absolute inset-e-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true" /></label>;
}

function ViewButton({ label, selected, onClick, children }: { label: string; selected: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} aria-pressed={selected} title={label} onClick={onClick} className={`inline-flex size-9 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${selected ? "border-emerald-800 bg-emerald-800 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"}`}>{children}</button>;
}

function Heading({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2.5 text-[9px] font-bold uppercase tracking-wide text-stone-500">{children}</th>;
}

function CoverThumb({ book, size }: { book: BookEntry; size: "table" | "card" }) {
  return <UploadCoverButton
    bookId={book.id}
    bookSlug={book.slug}
    hasCover={!!book.coverUrl}
    currentCoverUrl={book.coverUrl ?? undefined}
    thumbnailSize={size}
  />;
}

function CategoryBadge({ name, id }: { name: string | null; id: string | null }) {
  if (!name) return <span className="text-[10px] text-stone-400">—</span>;
  const palette = ["bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200", "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200", "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200", "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200"];
  const hash = [...(id ?? name)].reduce((value, character) => value + character.charCodeAt(0), 0);
  return <span className={`inline-block max-w-36 truncate rounded-full px-2 py-1 text-[9px] font-medium ${palette[hash % palette.length]}`} title={name}>{name}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const config = status === "PUBLISHED"
    ? { label: "Published", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" }
    : status === "ARCHIVED"
      ? { label: "Hidden", className: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200" }
      : { label: "Draft", className: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200" };
  return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-semibold ${config.className}`}>{config.label}</span>;
}

function BookActions({ book, categories, deleteAction, visibilityAction }: { book: BookEntry; categories: Category[]; deleteAction: (id: string) => Promise<void>; visibilityAction: (id: string, status: string) => Promise<void> }) {
  return <div className="flex items-center gap-1.5">
    <Link href={`/kutub/${book.slug}`} aria-label={`View ${book.title}`} title={`View ${book.title}`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"><Eye className="size-4" aria-hidden="true" /></Link>
    <EditBookButton book={toEditableBook(book)} categories={categories} compact />
    <BookActionMenu book={book} categories={categories} deleteAction={deleteAction} visibilityAction={visibilityAction} />
  </div>;
}

function BookActionMenu({ book, categories, deleteAction, visibilityAction, mobile = false }: { book: BookEntry; categories: Category[]; deleteAction: (id: string) => Promise<void>; visibilityAction: (id: string, status: string) => Promise<void>; mobile?: boolean }) {
  const coverKey = book.coverUrl ? book.coverUrl.split("/api/media/b2/")[1] : undefined;
  return <details className={`relative ${mobile ? "absolute inset-e-2 top-2" : ""}`}>
    <summary aria-label={`More actions for ${book.title}`} title="More actions" className={`${mobile ? "size-11" : "size-8"} inline-flex cursor-pointer list-none items-center justify-center rounded-md border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800`}><MoreHorizontal className="size-4" aria-hidden="true" /></summary>
    <div className={`absolute ${mobile ? "inset-e-0 top-12" : "inset-e-0 top-9"} z-30 flex min-w-44 flex-col gap-1 rounded-md border border-stone-200 bg-white p-2 shadow-lg dark:border-stone-700 dark:bg-stone-900`}>
      {mobile && <Link href={`/kutub/${book.slug}`} className="rounded px-2.5 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800">View book</Link>}
      {mobile && <EditBookButton book={toEditableBook(book)} categories={categories} />}
      <UploadPdfButton bookId={book.id} bookTitle={book.title} hasPdf={book.hasPdf} />
      <UploadCoverButton bookId={book.id} bookSlug={book.slug} hasCover={!!book.coverUrl} currentCoverUrl={book.coverUrl ?? undefined} />
      <ToggleVisibilityButton id={book.id} currentStatus={book.status} itemName={book.title} action={visibilityAction} />
      <DeleteButton action={deleteAction.bind(null, book.id)} itemName={book.title} itemType="book" />
    </div>
    {coverKey && <span className="sr-only">Cover: {coverKey}</span>}
  </details>;
}

function BookGridCard({ book, categories, deleteAction, visibilityAction, selected, onSelect }: { book: BookEntry; categories: Category[]; deleteAction: (id: string) => Promise<void>; visibilityAction: (id: string, status: string) => Promise<void>; selected: boolean; onSelect: (checked: boolean) => void }) {
  return <article className="relative rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
    <input type="checkbox" aria-label={`Select ${book.title}`} checked={selected} onChange={(event) => onSelect(event.target.checked)} className="absolute inset-s-3 top-3 size-4 accent-emerald-800" />
    <div className="flex gap-3 ps-7"><CoverThumb book={book} size="card" /><div className="min-w-0 flex-1"><h2 className="line-clamp-2 text-xs font-semibold text-stone-800 dark:text-stone-100" title={book.title}>{book.title}</h2><p className="mt-1 truncate text-[10px] text-stone-500">{book.author || "Unknown author"}</p><div className="mt-2"><CategoryBadge name={book.categoryName} id={book.categoryId} /></div><div className="mt-2 flex items-center gap-2"><StatusBadge status={book.status} /><span className="text-[9px] text-stone-500">{book.lessons} lessons</span></div></div><div className="shrink-0"><BookActions book={book} categories={categories} deleteAction={deleteAction} visibilityAction={visibilityAction} /></div></div>
  </article>;
}

function Footer({ start, end, total, page, pages, selected, disabled, onPage, onClear, onPublish, onDraft, mobile = false }: { start: number; end: number; total: number; page: number; pages: number; selected: number; disabled: boolean; onPage: (page: number) => void; onClear: () => void; onPublish: () => void; onDraft: () => void; mobile?: boolean }) {
  return <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800 ${mobile ? "rounded-md bg-white dark:bg-stone-900" : ""}`}>
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-stone-500 dark:text-stone-400">
      {selected > 0 ? <><span>{selected} selected</span><button type="button" disabled={disabled} onClick={onPublish} className="rounded border border-emerald-200 px-2 py-1 font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-300">Publish</button><button type="button" disabled={disabled} onClick={onDraft} className="rounded border border-stone-200 px-2 py-1 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">Set draft</button><button type="button" onClick={onClear} className="px-1 underline">Clear</button></> : <span>Showing {start}–{end} of {total} books</span>}
    </div>
    <div className="flex items-center gap-1" aria-label="Book pages">
      <PageButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="size-3.5" aria-hidden="true" /></PageButton>
      {pageNumbers(page, pages).map((number) => <button key={number} type="button" aria-current={number === page ? "page" : undefined} onClick={() => onPage(number)} className={`inline-flex size-7 items-center justify-center rounded-md text-[10px] font-semibold ${number === page ? "bg-emerald-800 text-white" : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"}`}>{number}</button>)}
      <PageButton label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="size-3.5" aria-hidden="true" /></PageButton>
    </div>
  </div>;
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="inline-flex size-7 items-center justify-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">{children}</button>;
}

function EmptyState() {
  return <div className="rounded-lg border border-dashed border-stone-300 bg-white px-5 py-12 text-center dark:border-stone-700 dark:bg-stone-900"><BookOpen className="mx-auto size-8 text-stone-300 dark:text-stone-600" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-stone-700 dark:text-stone-200">No books found</p><p className="mt-1 text-xs text-stone-500">Try changing your search or filters.</p></div>;
}

function FormField({ name, label, required, dir }: { name: string; label: string; required?: boolean; dir?: "rtl" }) {
  return <div><label htmlFor={`new-book-${name}`} className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">{label}{required ? " *" : ""}</label><input id={`new-book-${name}`} name={name} required={required} dir={dir} className="h-9 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-xs text-stone-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100" /></div>;
}

function SelectField({ id, name, label, defaultValue, children }: { id: string; name: string; label: string; defaultValue: string; children: ReactNode }) {
  return <div><label htmlFor={id} className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">{label}</label><select id={id} name={name} defaultValue={defaultValue} className="h-9 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-xs text-stone-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">{children}</select></div>;
}

function compareBooks(a: BookEntry, b: BookEntry, sort: SortOption) {
  if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
  if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
  const titleOrder = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  return sort === "title-asc" ? titleOrder : -titleOrder;
}

function pageNumbers(current: number, pages: number) {
  if (pages <= 5) return Array.from({ length: pages }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(current - 2, pages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function toEditableBook(book: BookEntry) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    translations: book.translations,
    author: book.author,
    authorTranslations: book.authorTranslations,
    description: book.description,
    descTranslations: book.descTranslations,
    status: book.status,
    categoryId: book.categoryId,
  };
}