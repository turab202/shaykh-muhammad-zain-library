"""
Auto-publisher for the Shaykh Muhammad Zain Library bulk import.

Converts a TelegramMessage (already in the DB) directly into a
PUBLISHED Lesson — plus creates any missing Categories, Books, and Series
— so the full archive appears on the public website in one run.

Used only for the ONE-TIME bulk import of the historical archive.
New posts after that go through the admin inbox (processedAt=NULL).

Rules:
  - Only messages with confidence >= MIN_CONFIDENCE are auto-published.
  - Low-confidence messages stay PENDING in the inbox for human review.
  - Raw Telegram fields are NEVER modified.
  - Series/Category/Book records are created if they don't exist.
  - A Lesson is created as PUBLISHED with the original Telegram date.
  - Media is linked when a downloaded file is present.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from .database import ImportDB, _cuid

log = logging.getLogger(__name__)

# Only auto-publish messages at or above this confidence threshold
MIN_CONFIDENCE = 0.6

# ─── Master catalogue ─────────────────────────────────────────────────────────
# Everything the channel publishes, fully mapped.

CATEGORY_BOOTSTRAP: dict[str, dict] = {
    "hadith": {
        "name": "Hadith Sciences",
        "ar": "علوم الحديث",
        "am": "የሐዲስ ሳይንስ",
        "icon": "BookOpen",
        "color": "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
        "desc": "Study of the sayings and traditions of the Prophet ﷺ",
        "desc_ar": "دراسة أحاديث النبي ﷺ وسننه",
    },
    "tafsir": {
        "name": "Tafsir",
        "ar": "التفسير",
        "am": "ተፍሲር",
        "icon": "Scroll",
        "color": "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
        "desc": "Quranic exegesis and commentary",
        "desc_ar": "تفسير القرآن الكريم وبيان معانيه",
    },
    "aqeedah": {
        "name": "Aqeedah",
        "ar": "العقيدة",
        "am": "ዐቂዳ",
        "icon": "Shield",
        "color": "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
        "desc": "Islamic creed and theology",
        "desc_ar": "أصول العقيدة الإسلامية",
    },
    "fiqh": {
        "name": "Fiqh",
        "ar": "الفقه",
        "am": "ፊቅህ",
        "icon": "Scale",
        "color": "bg-purple-50 text-purple-800 dark:bg-purple-950/30 dark:text-purple-300",
        "desc": "Islamic jurisprudence and law",
        "desc_ar": "الفقه الإسلامي وأحكامه",
    },
    "arabic": {
        "name": "Arabic Language",
        "ar": "اللغة العربية",
        "am": "አረብኛ ቋንቋ",
        "icon": "Languages",
        "color": "bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300",
        "desc": "Arabic grammar, morphology and linguistics",
        "desc_ar": "النحو والصرف وعلوم اللغة العربية",
    },
    "seerah": {
        "name": "Seerah",
        "ar": "السيرة النبوية",
        "am": "ሲራ",
        "icon": "Star",
        "color": "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300",
        "desc": "Biography of the Prophet ﷺ",
        "desc_ar": "سيرة النبي محمد ﷺ",
    },
    "adab": {
        "name": "Adab",
        "ar": "الآداب الشرعية",
        "am": "አዳብ",
        "icon": "Heart",
        "color": "bg-teal-50 text-teal-800 dark:bg-teal-950/30 dark:text-teal-300",
        "desc": "Islamic manners, etiquette and character",
        "desc_ar": "آداب الإسلام وأخلاقه",
    },
    "usul": {
        "name": "Usul al-Fiqh",
        "ar": "أصول الفقه",
        "am": "ፊቅህ ፕሪንሲፕሎች",
        "icon": "Layers",
        "color": "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300",
        "desc": "Principles of Islamic jurisprudence",
        "desc_ar": "علم أصول الفقه وقواعده",
    },
}

BOOK_BOOTSTRAP: dict[str, dict] = {
    "riyad-as-salihin": {
        "title": "Riyāḍ aṣ-Ṣāliḥīn",
        "ar": "رياض الصالحين",
        "am": "ሪያዱ ሷሊሒን",
        "author": "Imam Yaḥyā ibn Sharaf al-Nawawī (631–676 AH)",
        "author_ar": "الإمام يحيى بن شرف النووي (631–676 هـ)",
        "desc": "A comprehensive hadith collection organised around themes of piety and righteous conduct.",
        "desc_ar": "مجموعة حديثية شاملة تتناول موضوعات التقوى والعمل الصالح.",
        "category_slug": "hadith",
    },
    "tafsir-al-saadi": {
        "title": "Tafsīr as-Saʿdī (Taysīr al-Karīm ar-Raḥmān)",
        "ar": "تفسير السعدي (تيسير الكريم الرحمن)",
        "am": "ተፍሲሩ አስ-ሰዓዲይ",
        "author": "Shaykh ʿAbd ar-Raḥmān ibn Nāṣir as-Saʿdī (1307–1376 AH)",
        "author_ar": "الشيخ عبد الرحمن بن ناصر السعدي (1307–1376 هـ)",
        "desc": "A clear and accessible Quranic commentary by as-Sa'di.",
        "desc_ar": "تفسير ميسر للقرآن الكريم للشيخ السعدي.",
        "category_slug": "tafsir",
    },
    "al-qawl-al-mufid": {
        "title": "Al-Qawl al-Mufīd ʿalā Kitāb at-Tawḥīd",
        "ar": "القول المفيد على كتاب التوحيد",
        "am": "አል ቀውሉ ሙፊድ",
        "author": "Shaykh Muḥammad ibn Ṣāliḥ al-ʿUthaymīn (1347–1421 AH)",
        "author_ar": "الشيخ محمد بن صالح العثيمين (1347–1421 هـ)",
        "desc": "Commentary on Kitāb at-Tawḥīd by Sheikh al-Uthaymeen.",
        "desc_ar": "شرح كتاب التوحيد للشيخ محمد بن عبد الوهاب.",
        "category_slug": "aqeedah",
    },
    "sunan-al-nasai": {
        "title": "Sunan an-Nasāʾī (al-Mujtabā)",
        "ar": "سنن النسائي المجتبى",
        "am": "ሱነኑ ነሳኢይ",
        "author": "Imam Aḥmad ibn Shuʿayb an-Nasāʾī (215–303 AH)",
        "author_ar": "الإمام أحمد بن شعيب النسائي (215–303 هـ)",
        "desc": "One of the six canonical hadith collections.",
        "desc_ar": "أحد كتب السنة الستة الكبرى.",
        "category_slug": "hadith",
    },
    "tafsir-ibn-kathir": {
        "title": "Tafsīr Ibn Kathīr",
        "ar": "تفسير ابن كثير",
        "am": "ተፍሲር ኢብን ከሲር",
        "author": "Imam Ismāʿīl ibn ʿUmar Ibn Kathīr (701–774 AH)",
        "author_ar": "الإمام إسماعيل بن عمر ابن كثير (701–774 هـ)",
        "desc": "One of the most authoritative Quranic commentaries, relying on authentic narrations.",
        "desc_ar": "من أبرز كتب التفسير بالمأثور.",
        "category_slug": "tafsir",
    },
    "al-aqeedah-al-wasitiyyah": {
        "title": "Al-ʿAqīdah Al-Wāsiṭiyyah",
        "ar": "العقيدة الواسطية",
        "am": "አልዐቂዳ አልዋሲጢይያ",
        "author": "Shaykh al-Islām Ibn Taymiyyah (661–728 AH)",
        "author_ar": "شيخ الإسلام ابن تيمية (661–728 هـ)",
        "desc": "A concise treatise on the correct Sunni creed regarding the Names and Attributes of Allah.",
        "desc_ar": "متن مختصر في تقرير عقيدة أهل السنة والجماعة.",
        "category_slug": "aqeedah",
    },
    "al-ajrumiyyah": {
        "title": "Al-Muqaddimah Al-Ājurrūmiyyah",
        "ar": "المقدمة الآجرومية",
        "am": "አልአጅሩሚያ",
        "author": "Ibn Ājarrūm al-Ṣanhājī (672–723 AH)",
        "author_ar": "ابن آجروم الصنهاجي (672–723 هـ)",
        "desc": "The most widely studied classical primer on Arabic grammar.",
        "desc_ar": "متن في النحو العربي من أكثر المتون دراسةً.",
        "category_slug": "arabic",
    },
    "bulugh-al-maram": {
        "title": "Bulūgh al-Marām",
        "ar": "بلوغ المرام",
        "am": "ቡሉጉ አልምራም",
        "author": "Ibn Ḥajar al-ʿAsqalānī (773–852 AH)",
        "author_ar": "ابن حجر العسقلاني (773–852 هـ)",
        "desc": "A collection of hadith on Islamic jurisprudence.",
        "desc_ar": "كتاب في أحاديث الأحكام الفقهية.",
        "category_slug": "hadith",
    },
    "sunan-ibn-majah": {
        "title": "Sunan Ibn Mājah",
        "ar": "سنن ابن ماجه",
        "am": "ሱነኑ ኢብን ማጃህ",
        "author": "Imam Muḥammad ibn Yazīd Ibn Mājah (209–273 AH)",
        "author_ar": "الإمام محمد بن يزيد ابن ماجه (209–273 هـ)",
        "desc": "One of the six canonical hadith collections.",
        "desc_ar": "أحد كتب السنة الستة الكبرى.",
        "category_slug": "hadith",
    },
}

SERIES_BOOTSTRAP: dict[str, dict] = {
    "riyad-as-salihin": {
        "title": "Riyāḍ aṣ-Ṣāliḥīn",
        "ar": "رياض الصالحين",
        "am": "ሪያዱ ሷሊሒን",
        "desc": "A comprehensive study of the well-known hadith collection of Imam al-Nawawi",
        "desc_ar": "شرح مفصّل لكتاب رياض الصالحين للإمام النووي",
        "category_slug": "hadith",
        "book_slug": "riyad-as-salihin",
        "order": 1,
    },
    "tafsir-al-saadi": {
        "title": "Tafsīr as-Saʿdī",
        "ar": "تفسير السعدي",
        "am": "ተፍሲሩ አስ-ሰዓዲይ",
        "desc": "Explanation of the Noble Quran following the methodology of as-Sa'di",
        "desc_ar": "شرح تفسير السعدي للقرآن الكريم",
        "category_slug": "tafsir",
        "book_slug": "tafsir-al-saadi",
        "order": 2,
    },
    "al-qawl-al-mufid": {
        "title": "Al-Qawl al-Mufīd",
        "ar": "القول المفيد على كتاب التوحيد",
        "am": "አል ቀውሉ ሙፊድ",
        "desc": "Commentary on Kitāb at-Tawḥīd",
        "desc_ar": "شرح كتاب التوحيد",
        "category_slug": "aqeedah",
        "book_slug": "al-qawl-al-mufid",
        "order": 3,
    },
    "sunan-al-nasai": {
        "title": "Sunan an-Nasāʾī",
        "ar": "سنن النسائي",
        "am": "ሱነኑ ነሳኢይ",
        "desc": "Study of the Sunan of Imam an-Nasa'i",
        "desc_ar": "شرح سنن النسائي",
        "category_slug": "hadith",
        "book_slug": "sunan-al-nasai",
        "order": 4,
    },
    "tafsir-ibn-kathir": {
        "title": "Tafsīr Ibn Kathīr",
        "ar": "تفسير ابن كثير",
        "am": "ተፍሲር ኢብን ከሲር",
        "desc": "Explanation of the Noble Quran following the classical tafsir methodology",
        "desc_ar": "تفسير القرآن الكريم على منهج المفسرين الكلاسيكيين",
        "category_slug": "tafsir",
        "book_slug": "tafsir-ibn-kathir",
        "order": 5,
    },
    "al-aqeedah-al-wasitiyyah": {
        "title": "Al-ʿAqīdah Al-Wāsiṭiyyah",
        "ar": "العقيدة الواسطية",
        "am": "አልዐቂዳ አልዋሲጢይያ",
        "desc": "Study of Ibn Taymiyyah's foundational text on Islamic creed",
        "desc_ar": "شرح العقيدة الواسطية",
        "category_slug": "aqeedah",
        "book_slug": "al-aqeedah-al-wasitiyyah",
        "order": 6,
    },
    "al-ajrumiyyah": {
        "title": "Al-Ājurrūmiyyah",
        "ar": "الآجرومية",
        "am": "አልአጅሩሚያ",
        "desc": "Classical Arabic grammar through the famous introductory primer",
        "desc_ar": "شرح متن الآجرومية في النحو العربي",
        "category_slug": "arabic",
        "book_slug": "al-ajrumiyyah",
        "order": 7,
    },
    "bulugh-al-maram": {
        "title": "Bulūgh al-Marām",
        "ar": "بلوغ المرام",
        "am": "ቡሉጉ አልምራም",
        "desc": "Study of the hadith collection of Ibn Hajar al-Asqalani",
        "desc_ar": "شرح بلوغ المرام",
        "category_slug": "hadith",
        "book_slug": "bulugh-al-maram",
        "order": 8,
    },
    "sunan-ibn-majah": {
        "title": "Sunan Ibn Mājah",
        "ar": "سنن ابن ماجه",
        "am": "ሱነኑ ኢብን ማጃህ",
        "desc": "Study of the Sunan of Imam Ibn Majah",
        "desc_ar": "شرح سنن ابن ماجه",
        "category_slug": "hadith",
        "book_slug": "sunan-ibn-majah",
        "order": 9,
    },
    "matn-abi-shujaa": {
        "title": "Matn Abī Shujāʿ (Al-Ghāyah wat-Taqrīb)",
        "ar": "متن أبي شجاع (الغاية والتقريب)",
        "am": "ማተን አቢ ሹጃዕ",
        "desc": "Classical Shafi'i fiqh primer",
        "desc_ar": "متن في الفقه الشافعي",
        "category_slug": "fiqh",
        "book_slug": None,
        "order": 10,
    },
    "al-arbaeen-al-nawawiyyah": {
        "title": "Al-Arbaʿīn an-Nawawiyyah",
        "ar": "الأربعين النووية",
        "am": "አልአርባኢን አን-ነወዊያ",
        "desc": "Study of Imam al-Nawawi's forty hadith",
        "desc_ar": "شرح الأربعين النووية",
        "category_slug": "hadith",
        "book_slug": None,
        "order": 11,
    },
    "hilyat-talib-al-ilm": {
        "title": "Ḥilyat Ṭālib al-ʿIlm",
        "ar": "حلية طالب العلم",
        "am": "ሒልያ ጣሊቡ ኤልም",
        "desc": "A guide on the manners and etiquette of the student of knowledge",
        "desc_ar": "كتاب في آداب طالب العلم",
        "category_slug": "adab",
        "book_slug": None,
        "order": 12,
    },
    "al-usool-al-thalatha": {
        "title": "Al-Uṣūl al-Thalāthah",
        "ar": "الأصول الثلاثة",
        "am": "አልኡሱሉ ሰሰላሰ",
        "desc": "The Three Fundamental Principles by Muhammad ibn Abd al-Wahhab",
        "desc_ar": "الأصول الثلاثة للشيخ محمد بن عبد الوهاب",
        "category_slug": "aqeedah",
        "book_slug": None,
        "order": 13,
    },
}


# ─── Ensure helpers ───────────────────────────────────────────────────────────

def _jb(s: str) -> str:
    """JSON-encode a string for embedding in a jsonb literal."""
    return json.dumps(s, ensure_ascii=False)


def _ensure_category(db: ImportDB, slug: str) -> Optional[str]:
    existing = db.find_category_id_by_slug(slug)
    if existing:
        return existing
    data = CATEGORY_BOOTSTRAP.get(slug)
    if not data:
        log.warning("Unknown category slug '%s' — cannot auto-create.", slug)
        return None
    cat_id = _cuid()
    translations = json.dumps({"ar": data["ar"], "am": data["am"]}, ensure_ascii=False)
    desc_tr = json.dumps({"ar": data["desc_ar"]}, ensure_ascii=False)
    with db.conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO categories (
                id, slug, name, translations, description,
                "descTranslations", icon, "colorClass", "createdAt", "updatedAt"
            ) VALUES (%s,%s,%s,%s::jsonb,%s,%s::jsonb,%s,%s,NOW(),NOW())
            """,
            (cat_id, slug, data["name"], translations, data["desc"],
             desc_tr, data.get("icon"), data.get("color")),
        )
    db.conn.commit()
    log.info("  ✓ auto-created category: %s", data["name"])
    return cat_id


def _ensure_book(db: ImportDB, slug: str, category_id: Optional[str]) -> Optional[str]:
    existing = db.find_book_id_by_slug(slug)
    if existing:
        return existing
    data = BOOK_BOOTSTRAP.get(slug)
    if not data:
        return None
    # Ensure the book's own category
    cat_id = category_id or _ensure_category(db, data["category_slug"])
    book_id = _cuid()
    translations = json.dumps({"ar": data["ar"], "am": data["am"]}, ensure_ascii=False)
    author_tr = json.dumps({"ar": data["author_ar"]}, ensure_ascii=False)
    desc_tr = json.dumps({"ar": data["desc_ar"]}, ensure_ascii=False)
    with db.conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO books (
                id, slug, title, translations, author,
                "authorTranslations", description, "descTranslations",
                "categoryId", status, "publishedAt",
                "tableOfContents", "createdAt", "updatedAt"
            ) VALUES (
                %s,%s,%s,%s::jsonb,%s,
                %s::jsonb,%s,%s::jsonb,
                %s,'PUBLISHED',NOW(),
                '[]'::jsonb,NOW(),NOW()
            )
            """,
            (book_id, slug, data["title"], translations, data["author"],
             author_tr, data["desc"], desc_tr, cat_id),
        )
    db.conn.commit()
    log.info("  ✓ auto-created book: %s", data["title"])
    return book_id


def _ensure_series(db: ImportDB, slug: str) -> Optional[str]:
    existing = db.find_series_id_by_slug(slug)
    if existing:
        return existing
    data = SERIES_BOOTSTRAP.get(slug)
    if not data:
        log.warning("Unknown series slug '%s' — no bootstrap data.", slug)
        return None

    cat_id = _ensure_category(db, data["category_slug"])
    book_id = _ensure_book(db, data.get("book_slug", ""), cat_id) if data.get("book_slug") else None

    series_id = _cuid()
    translations = json.dumps({"ar": data["ar"], "am": data["am"]}, ensure_ascii=False)
    desc_tr = json.dumps({"ar": data.get("desc_ar", "")}, ensure_ascii=False)
    with db.conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO series (
                id, slug, title, translations, description,
                "descTranslations", "categoryId", "bookId",
                "order", status, "createdAt", "updatedAt"
            ) VALUES (
                %s,%s,%s,%s::jsonb,%s,
                %s::jsonb,%s,%s,
                %s,'PUBLISHED',NOW(),NOW()
            )
            """,
            (series_id, slug, data["title"], translations, data.get("desc", ""),
             desc_tr, cat_id, book_id, data.get("order", 0)),
        )
    db.conn.commit()
    log.info("  ✓ auto-created series: %s", data["title"])
    return series_id


# ─── Auto-publish ─────────────────────────────────────────────────────────────

def _make_lesson_slug(series_slug: str, lesson_number: Optional[int], tg_id: str) -> str:
    num = f"{lesson_number:04d}" if lesson_number else "xxxx"
    return f"{series_slug}-{num}-{tg_id[-6:]}"


def auto_publish_message(
    db: ImportDB,
    telegram_msg_id: str,
    suggested: dict,
    message_date: datetime,
    storage_key: Optional[str] = None,
    audio_filename: Optional[str] = None,
    duration_seconds: Optional[int] = None,
    file_size: int = 0,
    mime_type: str = "audio/mpeg",
) -> Optional[str]:
    """
    Create a PUBLISHED Lesson from a TelegramMessage that already exists in DB.
    Auto-creates Category, Book, Series if they are missing.
    Returns the new Lesson ID, or None if skipped.
    """
    confidence = float(suggested.get("confidence", 0.0))
    series_slug = suggested.get("series_slug")
    lesson_number = suggested.get("lesson_number")
    raw_title = suggested.get("title") or ""

    # Skip if confidence too low or no series identified
    if confidence < MIN_CONFIDENCE:
        log.info(
            "  ⏭  skip auto-publish (conf=%.2f < %.2f) msgId=%s",
            confidence, MIN_CONFIDENCE, telegram_msg_id,
        )
        return None

    if not series_slug:
        log.info("  ⏭  skip auto-publish (no series) msgId=%s", telegram_msg_id)
        return None

    # Ensure Series (creates Category + Book automatically)
    series_id = _ensure_series(db, series_slug)
    if not series_id:
        log.info("  ⏭  skip auto-publish (unknown series '%s')", series_slug)
        return None

    # Fetch category from series
    category_id: Optional[str] = None
    with db.conn.cursor() as cur:
        cur.execute('SELECT "categoryId" FROM series WHERE id = %s', (series_id,))
        row = cur.fetchone()
        category_id = row[0] if row else None

    # Build clean English title
    bootstrap = SERIES_BOOTSTRAP.get(series_slug, {})
    series_display = bootstrap.get("title", series_slug.replace("-", " ").title())
    if not raw_title or re.search(r'[\u0600-\u06FF\u1200-\u137F]', raw_title):
        # Title is Arabic or Amharic — generate English one
        title = f"{series_display} — Lesson {lesson_number}" if lesson_number else series_display
    else:
        title = raw_title

    # Arabic title from parsed data
    ar_title = raw_title if re.search(r'[\u0600-\u06FF]', raw_title) else ""

    # Unique slug
    lesson_slug = _make_lesson_slug(series_slug, lesson_number, telegram_msg_id)
    counter = 0
    base = lesson_slug
    while db.lesson_slug_exists(lesson_slug):
        counter += 1
        lesson_slug = f"{base}-{counter}"

    translations = json.dumps({"ar": ar_title}, ensure_ascii=False)
    published_at = message_date if message_date.tzinfo else message_date.replace(tzinfo=timezone.utc)

    lesson_id = _cuid()
    with db.conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO lessons (
                id, slug, "lessonNumber", title, translations,
                description, "descTranslations",
                "categoryId", "seriesId",
                status, "publishedAt", duration,
                "telegramSourceId", "playCount",
                "createdAt", "updatedAt"
            ) VALUES (
                %s,%s,%s,%s,%s::jsonb,
                NULL,'{}',
                %s,%s,
                'PUBLISHED',%s,%s,
                %s,0,
                NOW(),NOW()
            )
            """,
            (
                lesson_id, lesson_slug, lesson_number, title, translations,
                category_id, series_id,
                published_at, duration_seconds,
                telegram_msg_id,
            ),
        )

    # Link Media if we have a downloaded file
    if storage_key and audio_filename:
        media_id = _cuid()
        with db.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO media (
                    id, filename, "mimeType", size, duration,
                    "mediaType", "storageKey", "storageProvider",
                    "lessonId", "createdAt"
                ) VALUES (
                    %s,%s,%s,%s,%s,
                    'AUDIO'::"MediaType",%s,'LOCAL'::"StorageProvider",
                    %s,NOW()
                )
                """,
                (media_id, audio_filename, mime_type, file_size,
                 duration_seconds, storage_key, lesson_id),
            )

    # Mark TelegramMessage as processed
    meta = dict(suggested)
    meta["autoPublished"] = True
    meta["lessonId"] = lesson_id
    if storage_key:
        meta["mediaStorageKey"] = storage_key

    from .database import _dumps_telegram
    with db.conn.cursor() as cur:
        cur.execute(
            """UPDATE telegram_messages
               SET "processedAt"=NOW(), "suggestedMetadata"=%s
               WHERE id=%s""",
            (_dumps_telegram(meta), telegram_msg_id),
        )

    db.conn.commit()
    log.info(
        "  ✓ PUBLISHED: %s | series=%s | lesson#=%s | audio=%s",
        title[:55], series_slug, lesson_number,
        "✓" if storage_key else "—",
    )
    return lesson_id
