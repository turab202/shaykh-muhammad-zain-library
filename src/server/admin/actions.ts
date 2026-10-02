"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { z } from "zod";

async function guard() {
  try { await requireSession(); } catch { throw new Error("UNAUTHENTICATED"); }
}

// ── Categories ────────────────────────────────────────────

const CategorySchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  arName: z.string().optional(),
  amName: z.string().optional(),
  description: z.string().optional(),
  arDescription: z.string().optional(),
  icon: z.string().optional(),
  colorClass: z.string().optional(),
});

export async function createCategory(formData: FormData) {
  await guard();
  const data = CategorySchema.parse(Object.fromEntries(formData));
  await prisma.category.create({
    data: {
      slug: data.slug, name: data.name,
      translations: { ar: data.arName ?? "", am: data.amName ?? "" },
      description: data.description,
      descTranslations: { ar: data.arDescription ?? "" },
      icon: data.icon, colorClass: data.colorClass,
    },
  });
  revalidatePath("/[locale]/admin/categories", "page");
}

export async function updateCategory(id: string, formData: FormData) {
  await guard();
  const data = CategorySchema.parse(Object.fromEntries(formData));
  await prisma.category.update({
    where: { id },
    data: {
      slug: data.slug, name: data.name,
      translations: { ar: data.arName ?? "", am: data.amName ?? "" },
      description: data.description,
      descTranslations: { ar: data.arDescription ?? "" },
      icon: data.icon, colorClass: data.colorClass,
    },
  });
  revalidatePath("/[locale]/admin/categories", "page");
}

export async function deleteCategory(id: string) {
  await guard();
  await prisma.category.delete({ where: { id } });
  revalidatePath("/[locale]/admin/categories", "page");
}

// ── Series ───────────────────────────────────────────────

const SeriesSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  arTitle: z.string().optional(),
  amTitle: z.string().optional(),
  description: z.string().optional(),
  arDescription: z.string().optional(),
  categoryId: z.string().optional(),
  bookId: z.string().optional(),
  order: z.coerce.number().default(0),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

export async function createSeries(formData: FormData) {
  await guard();
  const data = SeriesSchema.parse(Object.fromEntries(formData));
  await prisma.series.create({
    data: {
      slug: data.slug, title: data.title, order: data.order, status: data.status,
      translations: { ar: data.arTitle ?? "", am: data.amTitle ?? "" },
      description: data.description,
      descTranslations: { ar: data.arDescription ?? "" },
      categoryId: data.categoryId || null,
      bookId: data.bookId || null,
    },
  });
  revalidatePath("/[locale]/admin/series", "page");
}

export async function updateSeries(id: string, formData: FormData) {
  await guard();
  const data = SeriesSchema.parse(Object.fromEntries(formData));
  await prisma.series.update({
    where: { id },
    data: {
      slug: data.slug, title: data.title, order: data.order, status: data.status,
      translations: { ar: data.arTitle ?? "", am: data.amTitle ?? "" },
      description: data.description,
      descTranslations: { ar: data.arDescription ?? "" },
      categoryId: data.categoryId || null,
      bookId: data.bookId || null,
    },
  });
  revalidatePath("/[locale]/admin/series", "page");
}

export async function deleteSeries(id: string) {
  await guard();
  await prisma.series.delete({ where: { id } });
  revalidatePath("/[locale]/admin/series", "page");
}

// ── Books ────────────────────────────────────────────────

const BookSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  arTitle: z.string().optional(),
  amTitle: z.string().optional(),
  author: z.string().optional(),
  arAuthor: z.string().optional(),
  description: z.string().optional(),
  arDescription: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

export async function createBook(formData: FormData) {
  await guard();
  const data = BookSchema.parse(Object.fromEntries(formData));
  await prisma.book.create({
    data: {
      slug: data.slug, title: data.title, author: data.author, status: data.status,
      translations: { ar: data.arTitle ?? "", am: data.amTitle ?? "" },
      authorTranslations: { ar: data.arAuthor ?? "" },
      description: data.description,
      descTranslations: { ar: data.arDescription ?? "" },
      categoryId: data.categoryId || null,
    },
  });
  revalidatePath("/[locale]/admin/books", "page");
}

export async function updateBook(id: string, formData: FormData) {
  await guard();
  const data = BookSchema.parse(Object.fromEntries(formData));
  await prisma.book.update({
    where: { id },
    data: {
      slug: data.slug, title: data.title, author: data.author, status: data.status,
      translations: { ar: data.arTitle ?? "", am: data.amTitle ?? "" },
      authorTranslations: { ar: data.arAuthor ?? "" },
      description: data.description,
      descTranslations: { ar: data.arDescription ?? "" },
      categoryId: data.categoryId || null,
    },
  });
  revalidatePath("/[locale]/admin/books", "page");
}

export async function deleteBook(id: string) {
  await guard();
  await prisma.book.delete({ where: { id } });
  revalidatePath("/[locale]/admin/books", "page");
}

// ── Lessons ──────────────────────────────────────────────

const LessonSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  arTitle: z.string().optional(),
  amTitle: z.string().optional(),
  description: z.string().optional(),
  arDescription: z.string().optional(),
  lessonNumber: z.coerce.number().optional(),
  duration: z.coerce.number().optional(),
  categoryId: z.string().optional(),
  seriesId: z.string().optional(),
  bookId: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  publishedAt: z.string().optional(),
});

export async function createLesson(formData: FormData) {
  await guard();
  const data = LessonSchema.parse(Object.fromEntries(formData));
  await prisma.lesson.create({
    data: {
      slug: data.slug, title: data.title, status: data.status,
      lessonNumber: data.lessonNumber,
      duration: data.duration,
      translations: { ar: data.arTitle ?? "", am: data.amTitle ?? "" },
      description: data.description,
      descTranslations: { ar: data.arDescription ?? "" },
      categoryId: data.categoryId || null,
      seriesId: data.seriesId || null,
      bookId: data.bookId || null,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    },
  });
  revalidatePath("/[locale]/admin/lessons", "page");
}

export async function updateLesson(id: string, formData: FormData) {
  await guard();
  const data = LessonSchema.parse(Object.fromEntries(formData));
  await prisma.lesson.update({
    where: { id },
    data: {
      slug: data.slug, title: data.title, status: data.status,
      lessonNumber: data.lessonNumber,
      duration: data.duration,
      translations: { ar: data.arTitle ?? "", am: data.amTitle ?? "" },
      description: data.description,
      descTranslations: { ar: data.arDescription ?? "" },
      categoryId: data.categoryId || null,
      seriesId: data.seriesId || null,
      bookId: data.bookId || null,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    },
  });
  revalidatePath("/[locale]/admin/lessons", "page");
}

export async function deleteLesson(id: string) {
  await guard();
  await prisma.lesson.delete({ where: { id } });
  revalidatePath("/[locale]/admin/lessons", "page");
}

export async function publishLesson(id: string) {
  await guard();
  await prisma.lesson.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  revalidatePath("/[locale]/admin/lessons", "page");
}

export async function unpublishLesson(id: string) {
  await guard();
  await prisma.lesson.update({ where: { id }, data: { status: "DRAFT" } });
  revalidatePath("/[locale]/admin/lessons", "page");
}

// ── Telegram Import ──────────────────────────────────────

export async function approveTelegramMessage(id: string, formData: FormData) {
  await guard();
  const session = await requireSession();
  const title = formData.get("title") as string;
  const seriesId = formData.get("seriesId") as string | null;
  const categoryId = formData.get("categoryId") as string | null;
  const bookId = formData.get("bookId") as string | null;
  const lessonNumber = formData.get("lessonNumber") ? Number(formData.get("lessonNumber")) : null;
  const description = formData.get("description") as string | null;

  if (!title) throw new Error("Title is required");

  // Update the suggested metadata (does NOT modify raw source fields)
  await prisma.telegramMessage.update({
    where: { id },
    data: {
      suggestedMetadata: { title, seriesId, categoryId, bookId, lessonNumber, description, approvedBy: session.userId },
      processedAt: new Date(),
    },
  });

  // Create the Lesson as DRAFT — human must explicitly publish from /admin/lessons.
  // Do NOT auto-publish. This satisfies the requirement that no Telegram import
  // content is published without an additional deliberate admin action.
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) + "-" + id.slice(0, 6);
  await prisma.lesson.create({
    data: {
      slug, title, status: "DRAFT", publishedAt: null,
      lessonNumber, description: description ?? undefined,
      categoryId: categoryId || null, seriesId: seriesId || null, bookId: bookId || null,
      telegramSourceId: id,
      translations: {},
    },
  });

  revalidatePath("/[locale]/admin/import", "page");
}

export async function rejectTelegramMessage(id: string, reason?: string) {
  await guard();
  await prisma.telegramMessage.update({
    where: { id },
    data: {
      processedAt: new Date(),
      suggestedMetadata: { rejected: true, reason: reason ?? "Rejected by admin" },
    },
  });
  revalidatePath("/[locale]/admin/import", "page");
}
