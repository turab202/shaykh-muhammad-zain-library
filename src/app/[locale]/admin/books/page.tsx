import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createBook, deleteBook, toggleBookVisibility } from "@/server/admin/actions";
import { BooksManagement } from "./BooksManagement";

export default async function AdminBooksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  try { await requireSession(); } catch { redirect(`/${locale}/login`); }

  const [books, categories] = await Promise.all([
    prisma.book.findMany({ orderBy: { title: "asc" }, include: { category: { select: { name: true } }, _count: { select: { lessons: true } }, media: { where: { mediaType: "PDF" }, select: { id: true } } } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const managerBooks = books.map((book) => ({
    id: book.id,
    slug: book.slug,
    title: book.title,
    translations: toStringRecord(book.translations),
    author: book.author,
    authorTranslations: toStringRecord(book.authorTranslations),
    description: book.description,
    descTranslations: toStringRecord(book.descTranslations),
    status: book.status,
    categoryId: book.categoryId,
    categoryName: book.category?.name ?? null,
    lessons: book._count.lessons,
    coverUrl: book.coverImageKey ? `/api/media/b2/${book.coverImageKey.split("/").slice(3).join("/")}` : null,
    hasPdf: book.media.length > 0,
    createdAt: book.createdAt.toISOString(),
  }));

  return <BooksManagement books={managerBooks} categories={categories} createAction={createBook} deleteAction={deleteBook} visibilityAction={toggleBookVisibility} />;
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
