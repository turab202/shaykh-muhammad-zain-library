"""
Deterministic metadata parser for Shaykh Muhammad Zain Telegram messages.

This module attempts to extract structured metadata from raw Telegram
captions/filenames using pattern matching and a known-content dictionary.
It NEVER modifies raw source fields. It NEVER calls any AI service.
It produces a SuggestedMetadata dict alongside the raw TelegramMessage.

If confidence is low (< threshold), the record goes into the Import Inbox
for human correction. The administrator's decision is always final.
"""

import re
from dataclasses import dataclass, field, asdict
from typing import Optional
import json


# ─── Known series / book catalogue ──────────────────────────────────────────
# Maps Arabic or transliterated names → internal slugs.
# Extend this as the actual archive is inspected.

KNOWN_SERIES: dict[str, str] = {
    # Arabic patterns → slug
    "رياض الصالحين": "riyad-as-salihin",
    "رياض": "riyad-as-salihin",
    "تفسير ابن كثير": "tafsir-ibn-kathir",
    "تفسير_السعدي": "tafsir-al-saadi",
    "تفسير السعدي": "tafsir-al-saadi",
    "تيسير الكريم": "tafsir-al-saadi",
    "القول المفيد": "al-qawl-al-mufid",
    "القول_المفيد": "al-qawl-al-mufid",
    "كتاب التوحيد": "al-qawl-al-mufid",
    "سنن النسائي": "sunan-al-nasai",
    "سنن_النسائي": "sunan-al-nasai",
    "العقيدة الواسطية": "al-aqeedah-al-wasitiyyah",
    "الواسطية": "al-aqeedah-al-wasitiyyah",
    "الآجرومية": "al-ajrumiyyah",
    "الأجرومية": "al-ajrumiyyah",
    "أجرومية": "al-ajrumiyyah",
    "متن أبي شجاع": "matn-abi-shujaa",
    "الأربعين النووية": "al-arbaeen-al-nawawiyyah",
    "الأربعين": "al-arbaeen-al-nawawiyyah",
    "بلوغ المرام": "bulugh-al-maram",
    "حلية طالب العلم": "hilyat-talib-al-ilm",
    "الورقات": "al-waraqat",
    # English / transliteration patterns
    "riyad": "riyad-as-salihin",
    "riyadh": "riyad-as-salihin",
    "ibn kathir": "tafsir-ibn-kathir",
    "al-saadi": "tafsir-al-saadi",
    "saadi": "tafsir-al-saadi",
    "al-qawl": "al-qawl-al-mufid",
    "nasai": "sunan-al-nasai",
    "nasaii": "sunan-al-nasai",
    "wasitiyyah": "al-aqeedah-al-wasitiyyah",
    "ajrumiyyah": "al-ajrumiyyah",
    "arbaeen": "al-arbaeen-al-nawawiyyah",
    "bulugh": "bulugh-al-maram",
}

KNOWN_CATEGORIES: dict[str, str] = {
    "حديث": "hadith",
    "الحديث": "hadith",
    "تفسير": "tafsir",
    "التفسير": "tafsir",
    "عقيدة": "aqeedah",
    "العقيدة": "aqeedah",
    "فقه": "fiqh",
    "الفقه": "fiqh",
    "توحيد": "aqeedah",
    "التوحيد": "aqeedah",
    "نحو": "arabic",
    "لغة": "arabic",
    "اللغة العربية": "arabic",
    "سيرة": "seerah",
    "السيرة": "seerah",
    "أدب": "adab",
    "الآداب": "adab",
    "أصول": "usul",
    "أصول الفقه": "usul",
}

# Series → category mapping
SERIES_TO_CATEGORY: dict[str, str] = {
    "riyad-as-salihin": "hadith",
    "al-arbaeen-al-nawawiyyah": "hadith",
    "bulugh-al-maram": "hadith",
    "sunan-al-nasai": "hadith",
    "tafsir-ibn-kathir": "tafsir",
    "tafsir-al-saadi": "tafsir",
    "al-aqeedah-al-wasitiyyah": "aqeedah",
    "al-qawl-al-mufid": "aqeedah",
    "al-ajrumiyyah": "arabic",
    "matn-abi-shujaa": "fiqh",
    "al-waraqat": "usul",
    "hilyat-talib-al-ilm": "adab",
}

# Series → book slug mapping
SERIES_TO_BOOK: dict[str, str] = {
    "riyad-as-salihin": "riyad-as-salihin",
    "tafsir-ibn-kathir": "tafsir-ibn-kathir",
    "al-aqeedah-al-wasitiyyah": "al-aqeedah-al-wasitiyyah",
    "al-ajrumiyyah": "al-ajrumiyyah",
}


# ─── Lesson-number patterns ───────────────────────────────────────────────────
# Matches: #1, درس 1, الدرس 1, Lesson 1, (1), ١, etc.

LESSON_NUMBER_PATTERNS: list[re.Pattern] = [
    re.compile(r"(?:درس|الدرس|مجلس|المجلس)\s*(?:#\s*)?(\d+)", re.IGNORECASE | re.UNICODE),
    re.compile(r"(?:lesson|lec|class|lecture)\s*#?\s*(\d+)", re.IGNORECASE),
    re.compile(r"#\s*(\d+)\b"),
    re.compile(r"\b(\d+)\s*[/-]\s*\d+\b"),   # e.g. "3/42" or "3-42"
    re.compile(r"\((\d+)\)"),
    # Arabic-Indic numerals ١٢٣ → convert to int
    re.compile(r"(?:درس|الدرس|مجلس)\s*([١٢٣٤٥٦٧٨٩٠]+)", re.UNICODE),
]

# Arabic-Indic digit map
_ARABIC_DIGITS = str.maketrans("١٢٣٤٥٦٧٨٩٠", "1234567890")


def _arabic_to_int(s: str) -> Optional[int]:
    converted = s.translate(_ARABIC_DIGITS)
    try:
        return int(converted)
    except ValueError:
        return None


# ─── URL / link extraction ────────────────────────────────────────────────────

URL_PATTERN = re.compile(
    r"https?://[^\s\u200b\u200c\u200d]+|t\.me/[^\s\u200b\u200c\u200d]+",
    re.IGNORECASE,
)


# ─── Title extraction ─────────────────────────────────────────────────────────
# Common caption structures in the archive:
#   "شرح رياض الصالحين - الدرس الثالث"
#   "تفسير ابن كثير | الدرس 5"
#   "Lesson 3: Introduction to Al-Wasitiyyah"
#   "الدرس ١٢ من سلسلة رياض الصالحين"

TITLE_SEPARATORS = re.compile(r"[|\-–—:،,\n]")


def _clean(text: str) -> str:
    return " ".join(text.split()).strip()


# ─── Main parser ─────────────────────────────────────────────────────────────

@dataclass
class SuggestedMetadata:
    """
    All fields here are SUGGESTIONS derived from deterministic parsing.
    They live in TelegramMessage.suggestedMetadata (JSONB).
    They NEVER overwrite the raw source fields.
    The administrator reviews and corrects these before approval.
    """
    title: Optional[str] = None
    title_ar: Optional[str] = None
    lesson_number: Optional[int] = None
    series_slug: Optional[str] = None
    category_slug: Optional[str] = None
    book_slug: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)
    confidence: float = 0.0          # 0.0 – 1.0
    confidence_reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def parse_caption(
    caption: Optional[str],
    audio_filename: Optional[str] = None,
) -> SuggestedMetadata:
    """
    Extract structured metadata from a Telegram message caption and/or
    audio filename using only deterministic rules.

    Key insight from the real @SheikhMuhammedZain channel:
    - Captions are minimal Amharic (e.g. "🔖 ተከታታይ ደርስ" = "Follow-up lesson")
    - ALL metadata is in the FILENAME:
        230_تفسير_السعدي_سورة_إبراهيم_الآية_٢٤_٣٤_.mp3
        038 -القول المفيد على كتاب التوحيد .mp3
        354_سنن_النسائي_09_كتاب_البيوع_...mp3
    - Pattern: {lesson_number}_{series_keywords}_{description}.mp3
    - So we search filename FIRST, then caption as fallback.

    Returns a SuggestedMetadata object. Confidence ranges from 0.0 to 1.0.
    Records with confidence < 0.5 go to Import Inbox for human correction.
    """
    meta = SuggestedMetadata()
    reasons = []

    # Build combined text — filename first (it has the real metadata)
    # Normalise: replace underscores with spaces for matching
    filename_normalised = (audio_filename or "").replace("_", " ").replace("-", " ")
    caption_text = caption or ""
    combined = filename_normalised + " " + caption_text
    combined_lower = combined.lower()

    # 1. Extract URLs from caption only
    if caption_text:
        meta.links = URL_PATTERN.findall(caption_text)

    # 2. Detect series — filename first, then caption
    for pattern, slug in KNOWN_SERIES.items():
        pat_normalised = pattern.replace("_", " ")
        if (pat_normalised.lower() in combined_lower or
                re.search(re.escape(pat_normalised), combined, re.IGNORECASE | re.UNICODE)):
            meta.series_slug = slug
            reasons.append(f"series matched: {pattern!r} → {slug}")
            break

    # 3. Detect category from text or series
    if not meta.series_slug:
        for pattern, slug in KNOWN_CATEGORIES.items():
            if pattern in combined or pattern.lower() in combined_lower:
                meta.category_slug = slug
                reasons.append(f"category matched: {pattern!r} → {slug}")
                break
    else:
        meta.category_slug = SERIES_TO_CATEGORY.get(meta.series_slug)
        if meta.category_slug:
            reasons.append(f"category inferred from series: {meta.series_slug}")

    # 4. Infer book from series
    if meta.series_slug and meta.series_slug in SERIES_TO_BOOK:
        meta.book_slug = SERIES_TO_BOOK[meta.series_slug]
        reasons.append(f"book inferred from series: {meta.series_slug}")

    # 5. Extract lesson number — check filename first (leading number pattern)
    # Real examples: "230_تفسير_السعدي_..." → 230
    #               "038 -القول المفيد..." → 38
    #               "354_سنن_النسائي_09_..." → 354
    if audio_filename:
        # Leading number before underscore or space
        m = re.match(r"^(\d{1,4})[_ \-]", audio_filename.strip())
        if m:
            num = int(m.group(1))
            if 1 <= num <= 9999:
                meta.lesson_number = num
                reasons.append(f"lesson number from filename prefix: {num}")

    # Fallback: search full text for number patterns
    if meta.lesson_number is None:
        for pat in LESSON_NUMBER_PATTERNS:
            m = pat.search(combined)
            if m:
                num_str = m.group(1)
                num = _arabic_to_int(num_str)
                if num is not None and 1 <= num <= 9999:
                    meta.lesson_number = num
                    reasons.append(f"lesson number from pattern: {num}")
                    break

    # 6. Extract title
    # Real channel: caption is just "🔖 ተከታታይ ደርስ" — not useful as title.
    # Use filename as the primary title source, cleaned up.
    if audio_filename:
        # Remove leading number prefix
        name = re.sub(r"^\d+[_ \-]+", "", audio_filename)
        # Remove file extension
        name = re.sub(r"\.(mp3|m4a|ogg|opus|wav|aac)$", "", name, flags=re.IGNORECASE)
        # Replace underscores/hyphens with spaces
        name = re.sub(r"[_\-]+", " ", name).strip()
        # Collapse multiple spaces
        name = re.sub(r"\s+", " ", name)
        if len(name) > 5:
            meta.title = name[:200]
            if re.search(r"[\u0600-\u06FF]", name):
                meta.title_ar = meta.title
            reasons.append(f"title from filename: {meta.title!r}")

    # Fallback: use caption if it contains Arabic/meaningful text
    if not meta.title and caption_text:
        parts = [_clean(p) for p in TITLE_SEPARATORS.split(caption_text) if _clean(p)]
        for part in parts:
            if len(part) > 5 and not re.match(r"^[\U0001F000-\U0001FFFF\s]+$", part):
                meta.title = part[:200]
                if re.search(r"[\u0600-\u06FF]", part):
                    meta.title_ar = meta.title
                reasons.append(f"title from caption: {meta.title!r}")
                break

    # 7. Confidence score
    score = 0.0
    if meta.series_slug:   score += 0.35
    if meta.category_slug: score += 0.15
    if meta.lesson_number is not None: score += 0.25
    if meta.title:         score += 0.20
    if meta.book_slug:     score += 0.05
    meta.confidence = round(min(score, 1.0), 2)
    meta.confidence_reasons = reasons

    return meta


def extract_links(text: Optional[str]) -> list[str]:
    if not text:
        return []
    return URL_PATTERN.findall(text)
