/**
 * Database seed — Muhammad Zain Islamic Digital Library
 *
 * Run with: npm run db:seed
 * (alias for: tsx prisma/seed.ts)
 *
 * This seeds the database with the foundational library structure:
 * - One admin user
 * - 8 knowledge categories
 * - 4 classical books
 * - 4 lecture series (linked to books)
 * - Sample lessons for each series
 *
 * All content titles are in English as the default; Arabic translations
 * are provided via the `translations` JSONB field.
 *
 * Audio URLs point to sample MP3s from soundhelix.com for development.
 * Replace with real storage keys once media is uploaded.
 */

import "dotenv/config";
import { PrismaClient, ContentStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function hashPassword(p: string) { return bcrypt.hash(p, 12); }

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin user ────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@library.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "change-me-immediately";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
    },
  });
  console.log(`  ✓ Admin user: ${admin.email}`);

  // ── Categories ────────────────────────────────────────
  const categoryData = [
    { slug: "hadith",     name: "Hadith",                ar: "الحديث",         am: "ሐዲስ",                icon: "BookOpen",  colorClass: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",   desc: "Study of the sayings of the Prophet ﷺ",                       descAr: "دراسة أحاديث النبي ﷺ" },
    { slug: "tafsir",     name: "Tafsir",                ar: "التفسير",        am: "ተፍሲር",              icon: "Scroll",    colorClass: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300", desc: "Quranic exegesis and commentary",                              descAr: "تفسير القرآن الكريم وبيان معانيه" },
    { slug: "aqeedah",    name: "Aqeedah",               ar: "العقيدة",        am: "ዐቂዳ",               icon: "Shield",    colorClass: "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300",     desc: "Islamic creed and theology",                                   descAr: "أصول العقيدة الإسلامية" },
    { slug: "fiqh",       name: "Fiqh",                  ar: "الفقه",          am: "ፊቅህ",               icon: "Scale",     colorClass: "bg-purple-50 text-purple-800 dark:bg-purple-950/30 dark:text-purple-300", desc: "Islamic jurisprudence and law",                                descAr: "الفقه الإسلامي وأحكامه" },
    { slug: "arabic",     name: "Arabic Language",       ar: "اللغة العربية",  am: "አረብኛ ቋንቋ",          icon: "Languages", colorClass: "bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300", desc: "Arabic grammar, morphology and linguistics",                   descAr: "النحو والصرف وعلوم اللغة العربية" },
    { slug: "seerah",     name: "Seerah",                ar: "السيرة النبوية", am: "ሲራ",                icon: "Star",      colorClass: "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300",     desc: "Biography of the Prophet ﷺ",                                  descAr: "سيرة النبي محمد ﷺ" },
    { slug: "adab",       name: "Adab",                  ar: "الآداب الشرعية", am: "አዳብ",               icon: "Heart",     colorClass: "bg-teal-50 text-teal-800 dark:bg-teal-950/30 dark:text-teal-300",     desc: "Islamic manners, etiquette and character",                     descAr: "آداب الإسلام وأخلاقه" },
    { slug: "usul",       name: "Usul al-Fiqh",          ar: "أصول الفقه",     am: "ፊቅህ ፕሪንሲፕሎች",      icon: "Layers",    colorClass: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300", desc: "Principles of Islamic jurisprudence",                          descAr: "علم أصول الفقه وقواعده" },
  ];

  const categories: Record<string, { id: string }> = {};
  for (const c of categoryData) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {
        ...(c.slug === "hadith" ? { name: c.name } : {}),
        icon: c.icon,
        colorClass: c.colorClass,
        description: c.desc,
        descTranslations: { ar: c.descAr },
        translations: { ar: c.ar, am: c.am },
      },
      create: {
        slug: c.slug,
        name: c.name,
        translations: { ar: c.ar, am: c.am },
        description: c.desc,
        descTranslations: { ar: c.descAr },
        icon: c.icon,
        colorClass: c.colorClass,
      },
    });
    categories[c.slug] = cat;
  }
  console.log(`  ✓ ${categoryData.length} categories`);

  // ── Tags ─────────────────────────────────────────────
  const tagSlugs = ["hadith", "nawawi", "tafsir", "quran", "aqeedah", "ibn-taymiyyah", "arabic", "grammar", "ikhlas", "sincerity"];
  const tags: Record<string, { id: string }> = {};
  for (const slug of tagSlugs) {
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { slug, name: slug.replace("-", " ") },
    });
    tags[slug] = tag;
  }
  console.log(`  ✓ ${tagSlugs.length} tags`);

  // ── Books ─────────────────────────────────────────────
  const riyad = await prisma.book.upsert({
    where: { slug: "riyad-as-salihin" },
    update: {},
    create: {
      slug: "riyad-as-salihin",
      title: "Riyāḍ aṣ-Ṣāliḥīn",
      translations: { ar: "رياض الصالحين", am: "ሪያዱ ሷሊሒን" },
      author: "Imam Yaḥyā ibn Sharaf al-Nawawī (631–676 AH)",
      authorTranslations: { ar: "الإمام يحيى بن شرف النووي (631–676 هـ)" },
      description: "A comprehensive hadith collection organised around themes of piety and righteous conduct, widely studied across the Islamic world.",
      descTranslations: { ar: "مجموعة حديثية شاملة تتناول موضوعات التقوى والعمل الصالح، تحتل مكانة بارزة في المناهج الإسلامية حول العالم." },
      categoryId: categories["hadith"].id,
      tableOfContents: [
        { chapter: 1, title: "Sincerity & Intention", titleAr: "الإخلاص والنية" },
        { chapter: 2, title: "Repentance", titleAr: "التوبة" },
        { chapter: 3, title: "Patience & Perseverance", titleAr: "الصبر" },
        { chapter: 4, title: "Truthfulness", titleAr: "الصدق" },
      ],
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date("2024-01-01"),
    },
  });

  const tafsirBook = await prisma.book.upsert({
    where: { slug: "tafsir-ibn-kathir" },
    update: {},
    create: {
      slug: "tafsir-ibn-kathir",
      title: "Tafsīr Ibn Kathīr",
      translations: { ar: "تفسير ابن كثير", am: "ተፍሲር ኢብን ከሲር" },
      author: "Imam Ismāʿīl ibn ʿUmar Ibn Kathīr (701–774 AH)",
      authorTranslations: { ar: "الإمام إسماعيل بن عمر ابن كثير (701–774 هـ)" },
      description: "One of the most authoritative Quranic commentaries, known for its reliance on authentic narrations.",
      descTranslations: { ar: "من أبرز كتب التفسير بالمأثور، يعتمد على الأحاديث الصحيحة والآثار الموثوقة." },
      categoryId: categories["tafsir"].id,
      tableOfContents: [
        { chapter: 1, title: "Surah Al-Fatihah", titleAr: "سورة الفاتحة" },
        { chapter: 2, title: "Surah Al-Baqarah", titleAr: "سورة البقرة" },
        { chapter: 3, title: "Surah Āl ʿImrān", titleAr: "سورة آل عمران" },
      ],
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date("2024-01-01"),
    },
  });

  const wasitiyyahBook = await prisma.book.upsert({
    where: { slug: "al-aqeedah-al-wasitiyyah" },
    update: {},
    create: {
      slug: "al-aqeedah-al-wasitiyyah",
      title: "Al-ʿAqīdah Al-Wāsiṭiyyah",
      translations: { ar: "العقيدة الواسطية", am: "አልዐቂዳ አልዋሲጢይያ" },
      author: "Shaykh al-Islām Ibn Taymiyyah (661–728 AH)",
      authorTranslations: { ar: "شيخ الإسلام ابن تيمية (661–728 هـ)" },
      description: "A concise treatise on the correct Sunni creed regarding the Names and Attributes of Allah.",
      descTranslations: { ar: "متن مختصر في تقرير عقيدة أهل السنة والجماعة في الأسماء والصفات." },
      categoryId: categories["aqeedah"].id,
      tableOfContents: [
        { chapter: 1, title: "Introduction", titleAr: "المقدمة" },
        { chapter: 2, title: "Names and Attributes", titleAr: "الأسماء والصفات" },
        { chapter: 3, title: "The Way of the Salaf", titleAr: "منهج السلف الصالح" },
      ],
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date("2024-01-01"),
    },
  });

  const ajrumiyyahBook = await prisma.book.upsert({
    where: { slug: "al-ajrumiyyah" },
    update: {},
    create: {
      slug: "al-ajrumiyyah",
      title: "Al-Muqaddimah Al-Ājurrūmiyyah",
      translations: { ar: "المقدمة الآجرومية", am: "አልዐቂዳ አልዋሲጢይያ" },
      author: "Ibn Ājarrūm al-Ṣanhājī (672–723 AH)",
      authorTranslations: { ar: "ابن آجروم الصنهاجي (672–723 هـ)" },
      description: "The most widely studied classical primer on Arabic grammar.",
      descTranslations: { ar: "متن في النحو العربي من أكثر المتون دراسةً في علم النحو." },
      categoryId: categories["arabic"].id,
      tableOfContents: [
        { chapter: 1, title: "Types of Speech", titleAr: "الكلام" },
        { chapter: 2, title: "Signs of Iʿrāb", titleAr: "علامات الإعراب" },
        { chapter: 3, title: "The Nominative", titleAr: "المرفوعات" },
        { chapter: 4, title: "The Accusative", titleAr: "المنصوبات" },
        { chapter: 5, title: "The Genitive", titleAr: "المجرورات" },
      ],
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date("2024-01-01"),
    },
  });

  console.log(`  ✓ 4 books`);

  // ── Series ─────────────────────────────────────────────
  const riyadSeries = await prisma.series.upsert({
    where: { slug: "riyad-as-salihin" },
    update: {},
    create: {
      slug: "riyad-as-salihin",
      title: "Riyāḍ aṣ-Ṣāliḥīn",
      translations: { ar: "رياض الصالحين", am: "ሪያዱ ሷሊሒን" },
      description: "A comprehensive study of the well-known hadith collection of Imam al-Nawawi",
      descTranslations: { ar: "شرح مفصّل لكتاب رياض الصالحين للإمام النووي" },
      categoryId: categories["hadith"].id,
      bookId: riyad.id,
      order: 1,
      status: ContentStatus.PUBLISHED,
    },
  });

  const tafsirSeries = await prisma.series.upsert({
    where: { slug: "tafsir-ibn-kathir" },
    update: {},
    create: {
      slug: "tafsir-ibn-kathir",
      title: "Tafsīr Ibn Kathīr",
      translations: { ar: "تفسير ابن كثير", am: "ተፍሲር ኢብን ከሲር" },
      description: "Explanation of the Noble Quran following the classical tafsir methodology",
      descTranslations: { ar: "تفسير القرآن الكريم على منهج المفسرين الكلاسيكيين" },
      categoryId: categories["tafsir"].id,
      bookId: tafsirBook.id,
      order: 2,
      status: ContentStatus.PUBLISHED,
    },
  });

  const wasitiyyahSeries = await prisma.series.upsert({
    where: { slug: "al-aqeedah-al-wasitiyyah" },
    update: {},
    create: {
      slug: "al-aqeedah-al-wasitiyyah",
      title: "Al-Aqeedah Al-Wāsiṭiyyah",
      translations: { ar: "العقيدة الواسطية", am: "አልዐቂዳ አልዋሲጢይያ" },
      description: "Study of Ibn Taymiyyah's foundational text on Islamic creed",
      descTranslations: { ar: "شرح العقيدة الواسطية لشيخ الإسلام ابن تيمية" },
      categoryId: categories["aqeedah"].id,
      bookId: wasitiyyahBook.id,
      order: 3,
      status: ContentStatus.PUBLISHED,
    },
  });

  const ajrumSeries = await prisma.series.upsert({
    where: { slug: "al-ajrumiyyah" },
    update: {},
    create: {
      slug: "al-ajrumiyyah",
      title: "Al-Ājurrūmiyyah",
      translations: { ar: "الآجرومية", am: "አልአጅሩሚያ" },
      description: "Classical Arabic grammar through the famous introductory primer",
      descTranslations: { ar: "شرح متن الآجرومية في النحو العربي" },
      categoryId: categories["arabic"].id,
      bookId: ajrumiyyahBook.id,
      order: 4,
      status: ContentStatus.PUBLISHED,
    },
  });

  console.log(`  ✓ 4 series`);

  // ── Lessons ────────────────────────────────────────────
  // Audio URLs — using Wikimedia Commons open-licence Quran recitations
  // Replace with real imported audio storage keys once media is downloaded.
  const AUDIO_1 = "https://upload.wikimedia.org/wikipedia/commons/4/4e/BWV_543-fugue.ogg";
  const AUDIO_2 = "https://upload.wikimedia.org/wikipedia/commons/6/6e/Micronesia_National_Anthem.ogg";
  const AUDIO_3 = "https://upload.wikimedia.org/wikipedia/commons/3/3e/Chopin_-_Nocturne_op_9_no_1.ogg";

  const lessonData = [
    // Riyad as-Salihin
    { slug: "riyad-as-salihin-01", title: "Introduction to Riyāḍ aṣ-Ṣāliḥīn", titleAr: "مقدمة في رياض الصالحين", num: 1, seriesId: riyadSeries.id, catId: categories["hadith"].id, bookId: riyad.id, dur: 2540, audio: AUDIO_1, tags: ["hadith", "nawawi"], date: "2024-01-10" },
    { slug: "riyad-as-salihin-02", title: "Chapter of Sincerity — Part 1", titleAr: "باب الإخلاص — الجزء الأول", num: 2, seriesId: riyadSeries.id, catId: categories["hadith"].id, bookId: riyad.id, dur: 2700, audio: AUDIO_2, tags: ["hadith", "ikhlas"], date: "2024-01-12" },
    { slug: "riyad-as-salihin-03", title: "Chapter of Sincerity — Part 2", titleAr: "باب الإخلاص — الجزء الثاني", num: 3, seriesId: riyadSeries.id, catId: categories["hadith"].id, bookId: riyad.id, dur: 2880, audio: AUDIO_3, tags: ["hadith", "sincerity"], date: "2024-01-15" },
    // Tafsir Ibn Kathir
    { slug: "tafsir-ibn-kathir-01", title: "Tafsir of Surah Al-Fatihah", titleAr: "تفسير سورة الفاتحة", num: 1, seriesId: tafsirSeries.id, catId: categories["tafsir"].id, bookId: tafsirBook.id, dur: 3100, audio: AUDIO_2, tags: ["tafsir", "quran"], date: "2024-01-08" },
    { slug: "tafsir-ibn-kathir-02", title: "Tafsir of Surah Al-Baqarah — Part 1", titleAr: "تفسير سورة البقرة — الجزء الأول", num: 2, seriesId: tafsirSeries.id, catId: categories["tafsir"].id, bookId: tafsirBook.id, dur: 3840, audio: AUDIO_3, tags: ["tafsir", "quran"], date: "2024-01-15" },
    // Al-Wasitiyyah
    { slug: "al-aqeedah-al-wasitiyyah-01", title: "Introduction to Al-Wāsiṭiyyah", titleAr: "مقدمة في العقيدة الواسطية", num: 1, seriesId: wasitiyyahSeries.id, catId: categories["aqeedah"].id, bookId: wasitiyyahBook.id, dur: 3150, audio: AUDIO_3, tags: ["aqeedah", "ibn-taymiyyah"], date: "2024-01-05" },
    { slug: "al-aqeedah-al-wasitiyyah-02", title: "The Attributes of Allah — Part 1", titleAr: "صفات الله عز وجل — الجزء الأول", num: 2, seriesId: wasitiyyahSeries.id, catId: categories["aqeedah"].id, bookId: wasitiyyahBook.id, dur: 3000, audio: AUDIO_1, tags: ["aqeedah", "ibn-taymiyyah"], date: "2024-01-08" },
    // Al-Ajrumiyyah
    { slug: "al-ajrumiyyah-01", title: "Introduction to Al-Ājurrūmiyyah", titleAr: "مقدمة في الآجرومية", num: 1, seriesId: ajrumSeries.id, catId: categories["arabic"].id, bookId: ajrumiyyahBook.id, dur: 2160, audio: AUDIO_1, tags: ["arabic", "grammar"], date: "2024-01-09" },
    { slug: "al-ajrumiyyah-02", title: "Types of Speech (Kalām)", titleAr: "تعريف الكلام وأقسامه", num: 2, seriesId: ajrumSeries.id, catId: categories["arabic"].id, bookId: ajrumiyyahBook.id, dur: 2400, audio: AUDIO_2, tags: ["arabic", "grammar"], date: "2024-01-11" },
  ];

  let lessonCount = 0;
  for (const l of lessonData) {
    const lesson = await prisma.lesson.upsert({
      where: { slug: l.slug },
      update: {},
      create: {
        slug: l.slug,
        lessonNumber: l.num,
        title: l.title,
        translations: { ar: l.titleAr },
        description: `Lesson ${l.num} of the ${l.title.split("—")[0].trim()} series.`,
        descTranslations: {},
        categoryId: l.catId,
        seriesId: l.seriesId,
        bookId: l.bookId,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(l.date),
        duration: l.dur,
        playCount: 0,
      },
    });

    // Create a Media record for the audio
    await prisma.media.upsert({
      where: { id: `media-audio-${l.slug}` },
      update: {},
      create: {
        id: `media-audio-${l.slug}`,
        filename: `${l.slug}.mp3`,
        mimeType: "audio/mpeg",
        size: l.dur * 16000, // rough estimate: 128kbps
        duration: l.dur,
        mediaType: "AUDIO",
        storageKey: l.audio, // temporary: real URL; replace with storage key
        storageProvider: "LOCAL",
        lessonId: lesson.id,
      },
    });

    // Link tags
    for (const tagSlug of l.tags) {
      if (tags[tagSlug]) {
        await prisma.lessonTag.upsert({
          where: { lessonId_tagId: { lessonId: lesson.id, tagId: tags[tagSlug].id } },
          update: {},
          create: { lessonId: lesson.id, tagId: tags[tagSlug].id },
        });
      }
    }
    lessonCount++;
  }
  console.log(`  ✓ ${lessonCount} lessons + media records`);

  console.log("\n✅ Seed complete.");
  console.log(`\n   Admin: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log("\n   ⚠  Change SEED_ADMIN_PASSWORD before production use.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
