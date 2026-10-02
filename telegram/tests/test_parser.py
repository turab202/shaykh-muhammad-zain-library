"""
Unit tests for the deterministic metadata parser.
Runs completely offline — no database, no Telegram, no AI.

Run with: py -m pytest telegram/tests/test_parser.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from telegram.importer.parser import parse_caption, extract_links, SuggestedMetadata


class TestLessonNumberExtraction:
    """Verify lesson number patterns from real archive caption formats."""

    def test_arabic_lesson_word(self):
        m = parse_caption("شرح رياض الصالحين - الدرس الثالث")
        # "الثالث" is not a digit — expect no lesson number here unless filename provides it
        # The main number patterns look for digits
        # This tests that we don't crash on non-digit ordinals

    def test_arabic_indic_numeral(self):
        m = parse_caption("تفسير ابن كثير | الدرس ١٢")
        assert m.lesson_number == 12, f"Expected 12, got {m.lesson_number}"

    def test_hashtag_number(self):
        m = parse_caption("العقيدة الواسطية #5")
        assert m.lesson_number == 5, f"Expected 5, got {m.lesson_number}"

    def test_fraction_style(self):
        m = parse_caption("رياض الصالحين (3/42)")
        assert m.lesson_number == 3, f"Expected 3, got {m.lesson_number}"

    def test_pipe_style(self):
        m = parse_caption("بلوغ المرام | الدرس 8")
        assert m.lesson_number == 8, f"Expected 8, got {m.lesson_number}"

    def test_english_lesson_prefix(self):
        m = parse_caption("Lesson 3: Introduction to Al-Wasitiyyah")
        assert m.lesson_number == 3, f"Expected 3, got {m.lesson_number}"

    def test_parenthesis_number(self):
        m = parse_caption("(12) شرح رياض الصالحين")
        assert m.lesson_number == 12, f"Expected 12, got {m.lesson_number}"

    def test_no_number_returns_none(self):
        m = parse_caption("درس مهم في العبادات")
        assert m.lesson_number is None


class TestSeriesDetection:
    """Verify series identification from caption text."""

    def test_riyad_arabic(self):
        m = parse_caption("شرح رياض الصالحين - الدرس 3")
        assert m.series_slug == "riyad-as-salihin", f"Got: {m.series_slug}"

    def test_tafsir_arabic(self):
        m = parse_caption("تفسير ابن كثير | الدرس ١٢")
        assert m.series_slug == "tafsir-ibn-kathir", f"Got: {m.series_slug}"

    def test_wasitiyyah(self):
        m = parse_caption("العقيدة الواسطية #5")
        assert m.series_slug == "al-aqeedah-al-wasitiyyah", f"Got: {m.series_slug}"

    def test_ajrumiyyah_pdf(self):
        m = parse_caption("متن الآجرومية - نسخة مرفقة للمطالعة")
        assert m.series_slug == "al-ajrumiyyah", f"Got: {m.series_slug}"

    def test_bulugh(self):
        m = parse_caption("بلوغ المرام | الدرس 8")
        assert m.series_slug == "bulugh-al-maram", f"Got: {m.series_slug}"

    def test_unknown_series_returns_none(self):
        m = parse_caption("درس مهم في العبادات")
        assert m.series_slug is None

    def test_series_infers_category(self):
        m = parse_caption("شرح رياض الصالحين - الدرس 3")
        assert m.category_slug == "hadith"

    def test_tafsir_infers_category(self):
        m = parse_caption("تفسير ابن كثير | الدرس ١٢")
        assert m.category_slug == "tafsir"

    def test_wasitiyyah_infers_category(self):
        m = parse_caption("العقيدة الواسطية #5")
        assert m.category_slug == "aqeedah"


class TestBookDetection:
    """Verify book linkage via series."""

    def test_riyad_links_to_book(self):
        m = parse_caption("رياض الصالحين (3/42)")
        assert m.book_slug == "riyad-as-salihin"

    def test_tafsir_links_to_book(self):
        m = parse_caption("تفسير ابن كثير | الدرس 4")
        assert m.book_slug == "tafsir-ibn-kathir"

    def test_unknown_no_book(self):
        m = parse_caption("درس في الآداب")
        assert m.book_slug is None


class TestTitleExtraction:
    """Verify title extraction from captions."""

    def test_title_from_first_segment(self):
        m = parse_caption("شرح رياض الصالحين - الدرس الثالث")
        assert m.title is not None
        assert len(m.title) > 5

    def test_title_from_filename_fallback(self):
        m = parse_caption(None, audio_filename="riyad_as_salihin_003.mp3")
        assert m.title is not None
        assert "riyad" in m.title.lower()

    def test_title_not_fabricated_for_ambiguous(self):
        """
        For a very short or pure-number caption, we should still attempt
        a title but must not fabricate religious content.
        """
        m = parse_caption("3")
        # title may be None or very short — we don't hallucinate content
        if m.title:
            assert len(m.title) < 10  # not an invented description


class TestConfidenceScoring:
    """Confidence should reflect how much metadata was extracted."""

    def test_full_detection_high_confidence(self):
        m = parse_caption("رياض الصالحين (3/42)\nباب الإخلاص")
        # series + category + lesson + title = 0.35+0.15+0.25+0.20 = 0.95
        assert m.confidence >= 0.7, f"Expected ≥0.7, got {m.confidence}"

    def test_ambiguous_low_confidence(self):
        m = parse_caption("درس مهم")
        assert m.confidence < 0.5, f"Expected <0.5, got {m.confidence}"

    def test_series_only_medium_confidence(self):
        m = parse_caption("رياض الصالحين")
        # series + category + book = 0.35+0.15+0.05 = 0.55, no lesson/title
        assert 0.4 <= m.confidence <= 0.8, f"Got: {m.confidence}"


class TestLinkExtraction:
    """Verify URL extraction from captions."""

    def test_telegram_link_extracted(self):
        caption = "العقيدة الواسطية #5\nhttps://t.me/ShaykhMuhammadZain_Archive/1855"
        links = extract_links(caption)
        assert any("t.me" in l for l in links), f"Links: {links}"

    def test_http_link_extracted(self):
        caption = "درس 3\nhttps://example.com/audio/lesson3.mp3"
        links = extract_links(caption)
        assert len(links) == 1
        assert "example.com" in links[0]

    def test_no_links_returns_empty(self):
        links = extract_links("شرح رياض الصالحين - الدرس الثالث")
        assert links == []

    def test_none_caption_returns_empty(self):
        links = extract_links(None)
        assert links == []


class TestRawPreservation:
    """
    Verify the parser ONLY produces suggestions — it does not mutate anything.
    The returned SuggestedMetadata is a fresh object, not a modification of input.
    """

    def test_original_caption_unchanged(self):
        caption = "شرح رياض الصالحين - الدرس الثالث"
        original = caption
        _ = parse_caption(caption)
        assert caption == original  # unchanged

    def test_returns_dataclass(self):
        m = parse_caption("رياض الصالحين (3/42)")
        assert isinstance(m, SuggestedMetadata)

    def test_to_dict_serializable(self):
        import json
        m = parse_caption("رياض الصالحين (3/42)\nhttps://t.me/channel/1")
        d = m.to_dict()
        # Must be JSON-serializable (goes into JSONB column)
        serialized = json.dumps(d)
        assert isinstance(serialized, str)
        loaded = json.loads(serialized)
        assert loaded["series_slug"] == "riyad-as-salihin"


class TestAllFixtureMessages:
    """
    Process every message in the fixture file with the parser
    and verify the expected outcomes for each case.
    """

    def _load_fixture(self):
        import json, os
        path = os.path.join(os.path.dirname(__file__), "../fixtures/sample_messages.json")
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    def test_case1_riyad_lesson3(self):
        msgs = self._load_fixture()
        msg = next(m for m in msgs if m["message_id"] == 1842 and "DUPLICATE" not in m.get("caption", ""))
        m = parse_caption(msg["caption"], msg.get("audio_filename"))
        assert m.series_slug == "riyad-as-salihin"
        assert m.category_slug == "hadith"
        assert m.confidence >= 0.5

    def test_case2_tafsir_lesson12_arabic_numerals(self):
        msgs = self._load_fixture()
        msg = next(m for m in msgs if m["message_id"] == 1849)
        m = parse_caption(msg["caption"], msg.get("audio_filename"))
        assert m.series_slug == "tafsir-ibn-kathir"
        assert m.lesson_number == 12

    def test_case3_wasitiyyah_with_link(self):
        msgs = self._load_fixture()
        msg = next(m for m in msgs if m["message_id"] == 1855)
        m = parse_caption(msg["caption"], msg.get("audio_filename"))
        assert m.series_slug == "al-aqeedah-al-wasitiyyah"
        assert m.lesson_number == 5
        assert len(m.links) > 0

    def test_case4_ambiguous_needs_review(self):
        msgs = self._load_fixture()
        msg = next(m for m in msgs if m["message_id"] == 1861)
        m = parse_caption(msg["caption"], msg.get("audio_filename"))
        # Low confidence — will go to Import Inbox for human review
        assert m.confidence < 0.5
        assert m.series_slug is None

    def test_case5_pdf_ajrumiyyah(self):
        msgs = self._load_fixture()
        msg = next(m for m in msgs if m["message_id"] == 1865)
        m = parse_caption(msg["caption"], msg.get("audio_filename"))
        assert m.series_slug == "al-ajrumiyyah"
        assert m.category_slug == "arabic"

    def test_case6_riyad_fraction_style(self):
        msgs = self._load_fixture()
        msg = next(m for m in msgs if m["message_id"] == 1870)
        m = parse_caption(msg["caption"], msg.get("audio_filename"))
        assert m.series_slug == "riyad-as-salihin"
        assert m.lesson_number == 3

    def test_case7_bulugh(self):
        msgs = self._load_fixture()
        msg = next(m for m in msgs if m["message_id"] == 1874)
        m = parse_caption(msg["caption"], msg.get("audio_filename"))
        assert m.series_slug == "bulugh-al-maram"
        assert m.lesson_number == 8
        assert m.category_slug == "hadith"
