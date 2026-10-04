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
  audioMediaId: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  publishedAt: z.string().optional(),
});

function revalidateLessonPages() {
  for (const path of [
    "/[locale]/admin/lessons",
    "/[locale]/duruus",
    "/[locale]/duruus/[slug]",
    "/[locale]/series",
    "/[locale]/series/[slug]",
    "/[locale]/categories",
    "/[locale]/categories/[slug]",
    "/[locale]/kutub/[slug]",
    "/[locale]",
  ]) {
    revalidatePath(path, "page");
  }
}

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
  revalidateLessonPages();
}

export async function updateLesson(id: string, formData: FormData) {
  await guard();
  const data = LessonSchema.parse(Object.fromEntries(formData));
  const hasAudioSelection = formData.has("audioMediaId");
  const audioMediaId = data.audioMediaId || null;

  await prisma.$transaction(async (tx) => {
    if (hasAudioSelection && audioMediaId) {
      const selectableAudio = await tx.media.findFirst({
        where: {
          id: audioMediaId,
          mediaType: "AUDIO",
          OR: [{ lessonId: null }, { lessonId: id }],
        },
        select: { id: true },
      });
      if (!selectableAudio) {
        throw new Error("This audio file is already assigned to another lesson or is unavailable.");
      }
    }

    await tx.lesson.update({
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

    if (hasAudioSelection) {
      await tx.media.updateMany({
        where: {
          lessonId: id,
          mediaType: "AUDIO",
          ...(audioMediaId ? { id: { not: audioMediaId } } : {}),
        },
        data: { lessonId: null },
      });

      if (audioMediaId) {
        await tx.media.update({ where: { id: audioMediaId }, data: { lessonId: id } });
      }
    }
  });
  revalidateLessonPages();
}

export async function deleteLesson(id: string) {
  await guard();
  await prisma.lesson.delete({ where: { id } });
  revalidatePath("/[locale]/admin/lessons", "page");
}

export async function publishLesson(id: string) {
  await guard();
  await prisma.lesson.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  revalidateLessonPages();
}

export async function unpublishLesson(id: string) {
  await guard();
  await prisma.lesson.update({ where: { id }, data: { status: "DRAFT" } });
  revalidateLessonPages();
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

// ── Bulk publish all pending Telegram inbox messages ────────────────────────
//
// Runs the Python publisher logic directly from JS: for each pending
// TelegramMessage that has a series_slug in its suggestedMetadata and
// confidence >= 0.6, we create a PUBLISHED Lesson, ensure Series/Category
// exist, and mark the message as processed.
//
// This is the "Publish All" one-click action for the bulk import.

export type BulkPublishState =
  | { published: number; skipped: number; error?: string }
  | undefined;

/** Series display names used when creating new series records. */
const SERIES_META: Record<string, { title: string; arTitle: string; amTitle: string; categorySlug: string }> = {
  "riyad-as-salihin":          { title: "Riyāḍ aṣ-Ṣāliḥīn",          arTitle: "رياض الصالحين",                      amTitle: "ሪያዱ ሷሊሒን",             categorySlug: "hadith"  },
  "tafsir-al-saadi":           { title: "Tafsīr as-Saʿdī",             arTitle: "تفسير السعدي",                       amTitle: "ተፍሲሩ አስ-ሰዓዲይ",         categorySlug: "tafsir"  },
  "al-qawl-al-mufid":          { title: "Al-Qawl al-Mufīd",            arTitle: "القول المفيد على كتاب التوحيد",      amTitle: "አል ቀውሉ ሙፊድ",           categorySlug: "aqeedah" },
  "sunan-al-nasai":            { title: "Sunan an-Nasāʾī",             arTitle: "سنن النسائي",                        amTitle: "ሱነኑ ነሳኢይ",              categorySlug: "hadith"  },
  "tafsir-ibn-kathir":         { title: "Tafsīr Ibn Kathīr",           arTitle: "تفسير ابن كثير",                     amTitle: "ተፍሲር ኢብን ከሲር",          categorySlug: "tafsir"  },
  "al-aqeedah-al-wasitiyyah":  { title: "Al-ʿAqīdah Al-Wāsiṭiyyah",   arTitle: "العقيدة الواسطية",                   amTitle: "አልዐቂዳ አልዋሲጢይያ",        categorySlug: "aqeedah" },
  "al-ajrumiyyah":             { title: "Al-Ājurrūmiyyah",             arTitle: "الآجرومية",                          amTitle: "አልአጅሩሚያ",               categorySlug: "arabic"  },
  "bulugh-al-maram":           { title: "Bulūgh al-Marām",             arTitle: "بلوغ المرام",                        amTitle: "ቡሉጉ አልምራም",             categorySlug: "hadith"  },
  "sunan-ibn-majah":           { title: "Sunan Ibn Mājah",             arTitle: "سنن ابن ماجه",                       amTitle: "ሱነኑ ኢብን ማጃህ",           categorySlug: "hadith"  },
  "matn-abi-shujaa":           { title: "Matn Abī Shujāʿ",             arTitle: "متن أبي شجاع",                       amTitle: "ማተን አቢ ሹጃዕ",             categorySlug: "fiqh"    },
  "al-arbaeen-al-nawawiyyah":  { title: "Al-Arbaʿīn an-Nawawiyyah",    arTitle: "الأربعين النووية",                   amTitle: "አልአርባኢን",                categorySlug: "hadith"  },
  "hilyat-talib-al-ilm":       { title: "Ḥilyat Ṭālib al-ʿIlm",        arTitle: "حلية طالب العلم",                    amTitle: "ሒልያ ጣሊቡ ኤልም",           categorySlug: "adab"    },
  "al-usool-al-thalatha":      { title: "Al-Uṣūl al-Thalāthah",         arTitle: "الأصول الثلاثة",                     amTitle: "አልኡሱሉ ሰሰላሰ",            categorySlug: "aqeedah" },
};

async function ensureSeries(seriesSlug: string): Promise<string | null> {
  const existing = await prisma.series.findUnique({ where: { slug: seriesSlug } });
  if (existing) return existing.id;

  const meta = SERIES_META[seriesSlug];
  if (!meta) return null;

  // Ensure category
  let category = await prisma.category.findUnique({ where: { slug: meta.categorySlug } });
  if (!category) return null; // categories must be seeded already

  const series = await prisma.series.create({
    data: {
      slug: seriesSlug,
      title: meta.title,
      translations: { ar: meta.arTitle, am: meta.amTitle },
      description: "",
      descTranslations: {},
      categoryId: category.id,
      order: 0,
      status: "PUBLISHED",
    },
  });
  return series.id;
}

export async function publishAllPending(): Promise<BulkPublishState> {
  await guard();

  const pending = await prisma.telegramMessage.findMany({
    where: { processedAt: null, chatId: "1747155048" },
    orderBy: { date: "asc" },
  });

  let published = 0;
  let skipped = 0;

  for (const msg of pending) {
    const meta = msg.suggestedMetadata as Record<string, unknown>;
    const confidence = Number(meta?.confidence ?? 0);
    const seriesSlug = meta?.series_slug as string | undefined;
    const lessonNumber = meta?.lesson_number as number | undefined;
    const rawTitle = (meta?.title as string) ?? "";

    // Skip low-confidence or unidentified messages — leave in inbox
    if (confidence < 0.6 || !seriesSlug) {
      skipped++;
      continue;
    }

    try {
      const seriesId = await ensureSeries(seriesSlug);
      if (!seriesId) { skipped++; continue; }

      // Get category from series
      const series = await prisma.series.findUnique({
        where: { id: seriesId },
        select: { categoryId: true, bookId: true },
      });

      // Build English title
      const seriesMeta = SERIES_META[seriesSlug];
      const seriesDisplay = seriesMeta?.title ?? seriesSlug.replace(/-/g, " ");
      const hasArabic = /[\u0600-\u06FF]/.test(rawTitle);
      const title = (!rawTitle || hasArabic)
        ? (lessonNumber ? `${seriesDisplay} — Lesson ${lessonNumber}` : seriesDisplay)
        : rawTitle;

      const arTitle = hasArabic ? rawTitle : "";

      // Generate unique slug
      const base = `${seriesSlug}-${String(lessonNumber ?? 0).padStart(4, "0")}-${msg.id.slice(-6)}`;
      let slug = base;
      let counter = 0;
      while (await prisma.lesson.findUnique({ where: { slug } })) {
        slug = `${base}-${++counter}`;
      }

      // Resolve storageKey from suggestedMetadata (set by importer when media was downloaded)
      const storageKey = (meta?.mediaStorageKey as string) ?? null;
      const audioFilename = msg.audioFilename ?? null;

      // Create PUBLISHED lesson
      const lesson = await prisma.lesson.create({
        data: {
          slug,
          title,
          lessonNumber: lessonNumber ?? null,
          translations: { ar: arTitle },
          descTranslations: {},
          categoryId: series?.categoryId ?? null,
          bookId: series?.bookId ?? null,
          seriesId,
          status: "PUBLISHED",
          publishedAt: msg.date,
          duration: 0,
          telegramSourceId: msg.id,
          playCount: 0,
        },
      });

      // Link media if storageKey is present
      if (storageKey && audioFilename) {
        await prisma.media.create({
          data: {
            filename: audioFilename,
            mimeType: "audio/mpeg",
            size: 0,
            mediaType: "AUDIO",
            storageKey,
            storageProvider: "LOCAL",
            lessonId: lesson.id,
          },
        });
      }

      // Mark as processed
      await prisma.telegramMessage.update({
        where: { id: msg.id },
        data: {
          processedAt: new Date(),
          suggestedMetadata: {
            ...(meta as object),
            autoPublished: true,
            lessonId: lesson.id,
          },
        },
      });

      published++;
    } catch (err) {
      console.error(`publishAllPending: failed for msg ${msg.id}:`, err);
      skipped++;
    }
  }

  revalidatePath("/[locale]/admin/import", "page");
  revalidatePath("/[locale]/admin/lessons", "page");
  revalidatePath("/[locale]/duruus", "page");
  revalidatePath("/", "page");

  return { published, skipped };
}
