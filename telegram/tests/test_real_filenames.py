"""
Test parser against real filenames observed from @SheikhMuhammedZain.
Run: py telegram/tests/test_real_filenames.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from telegram.importer.parser import parse_caption

real_cases = [
    # (filename, caption, expected_series, expected_lesson)
    ("230_تفسير_السعدي_سورة_إبراهيم_الآية_٢٤_٣٤_.mp3",  "🔖 ተከታታይ  ደርስ", "tafsir-al-saadi", 230),
    ("038 -القول المفيد على كتاب التوحيد .mp3",           "🔖አዲስ ተከታታይ  ደርስ", "al-qawl-al-mufid", 38),
    ("354_سنن_النسائي_09_كتاب_البيوع_رقم_الحديث_٤٥٧٥_٤٥٨٦_.mp3", "🔖ተከታታይ  ደርስ", "sunan-al-nasai", 354),
    ("229_تفسير_السعدي_سورة_إبراهيم_الآية_١٨_٢٣_.mp3",  "🔖 ተከታታይ  ደርስ", "tafsir-al-saadi", 229),
    ("037 -القول المفيد على كتاب التوحيد .mp3",           "🔖አዲስ ተከታታይ  ደርስ", "al-qawl-al-mufid", 37),
    ("353_سنن_النسائي_08_كتاب_البيوع_رقم_الحديث_٤٥٦٧_٤٥٧٤_.mp3", "🔖ተከታታይ  ደርስ", "sunan-al-nasai", 353),
    ("228_تفسير_السعدي_سورة_إبراهيم_الآية_١٠_١٧_1.mp3", "🔖 ተከታታይ  ደርስ", "tafsir-al-saadi", 228),
]

print("\nReal @SheikhMuhammedZain filename parser test")
print("=" * 70)

passed = 0
failed = 0

for fn, cap, exp_series, exp_lesson in real_cases:
    m = parse_caption(cap, fn)
    ok_series = m.series_slug == exp_series
    ok_lesson = m.lesson_number == exp_lesson
    ok = ok_series and ok_lesson
    status = "PASS" if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1

    print(f"\n  [{status}] {fn[:55]}")
    print(f"       series : {m.series_slug or '—':35} expected={exp_series}")
    print(f"       lesson : {str(m.lesson_number or '—'):>5}              expected={exp_lesson}")
    print(f"       conf   : {m.confidence}")
    print(f"       title  : {(m.title or '—')[:65]}")
    if not ok_series:
        print(f"       *** SERIES MISMATCH ***")
    if not ok_lesson:
        print(f"       *** LESSON MISMATCH ***")

print(f"\n{'='*70}")
print(f"  {passed} passed, {failed} failed")
print()

if failed:
    sys.exit(1)
