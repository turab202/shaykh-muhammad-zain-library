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
    "تفسير": "tafsir-ibn-kathir",
    "العقيدة الواسطية": "al-aqeedah-al-wasitiyyah",
    "الواسطية": "al-aqeedah-al-wasitiyyah",
    "الآجرومية": "al-ajrumiyyah",
    "الأجرومية": "al-ajrumiyyah",
    "أجرومية": "al-ajrumiyyah",
    "متن أبي شجاع": "matn-abi-shujaa",
    "أبو شجاع": "matn-abi-shujaa",
    "الأربعين النووية": "al-arbaeen-al-nawawiyyah",
    "الأربعين": "al-arbaeen-al-nawawiyyah",
    "بلوغ المرام": "bulugh-al-maram",
    "حلية طالب العلم": "hilyat-talib-al-ilm",
    "الورقات": "al-waraqat",
    # English / transliteration patterns
    "riyad": "riyad-as-salihin",
    "riyadh": "riyad-as-salihin",
    "ibn kathir": "tafsir-ibn-kathir",
    "wasitiyyah": "al-aqeedah-al-wasitiyyah",
    "wasitiyya": "al-aqeedah-al-wasitiyyah",
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

# Series → category mapping (used when series is detected but category is not)
SERIES_TO_CATEGORY: dict[str, str] = {
    "riyad-as-salihin": "hadith",
    "al-arbaeen-al-nawawiyyah": "hadith",
    "bulugh-al-maram": "hadith",
    "tafsir-ibn-kathir": "tafsir",
    "al-aqeedah-al-wasitiyyah": "aqeedah",
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

    Returns a SuggestedMetadata object. Confidence ranges from 0.0 (nothing
    detected) to 1.0 (all fields detected with high certainty). Records with
    confidence < 0.5 go to the Import Inbox for human correction.
    """
    meta = SuggestedMetadata()
    text = (caption or "") + " " + (audio_filename or "")
    text_lower = text.lower()

    reasons = []

    # 1. Extract URLs / links from original caption only
    if caption:
        meta.links = URL_PATTERN.findall(caption)

    # 2. Detect series
    for pattern, slug in KNOWN_SERIES.items():
        if pattern.lower() in text_lower or re.search(re.escape(pattern), text, re.IGNORECASE | re.UNICODE):
            meta.series_slug = slug
            reasons.append(f"series matched: {pattern!r} → {slug}")
            break

    # 3. Detect category (from text or series mapping)
    if not meta.series_slug:
        for pattern, slug in KNOWN_CATEGORIES.items():
            if pattern in text or pattern.lower() in text_lower:
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

    # 5. Extract lesson number
    for pat in LESSON_NUMBER_PATTERNS:
        m = pat.search(text)
        if m:
            num_str = m.group(1)
            num = _arabic_to_int(num_str)
            if num is not None and 1 <= num <= 9999:
                meta.lesson_number = num
                reasons.append(f"lesson number extracted: {num} (pattern: {pat.pattern!r})")
                break

    # 6. Extract a candidate title
    # Strategy: take the longest meaningful segment from the caption
    if caption:
        # Split on separators and take the first non-empty, non-number part
        parts = [_clean(p) for p in TITLE_SEPARATORS.split(caption) if _clean(p)]
        for part in parts:
            # Skip if it's purely a number or very short
            if len(part) > 5 and not re.match(r"^\d+$", part):
                meta.title = part[:200]
                # Heuristic: if contains Arabic script, mark as Arabic title
                if re.search(r"[\u0600-\u06FF]", part):
                    meta.title_ar = meta.title
                reasons.append(f"title extracted from caption segment: {meta.title!r}")
                break

    # 7. Fall back to audio filename as title hint
    if not meta.title and audio_filename:
        name = re.sub(r"\.(mp3|m4a|ogg|wav|opus)$", "", audio_filename, flags=re.IGNORECASE)
        name = re.sub(r"[_\-]+", " ", name).strip()
        if len(name) > 3:
            meta.title = name[:200]
            reasons.append(f"title from filename: {meta.title!r}")

    # 8. Compute confidence score
    score = 0.0
    if meta.series_slug:
        score += 0.35
    if meta.category_slug:
        score += 0.15
    if meta.lesson_number is not None:
        score += 0.25
    if meta.title:
        score += 0.20
    if meta.book_slug:
        score += 0.05
    meta.confidence = round(min(score, 1.0), 2)
    meta.confidence_reasons = reasons

    return meta


def extract_links(text: Optional[str]) -> list[str]:
    if not text:
        return []
    return URL_PATTERN.findall(text)
