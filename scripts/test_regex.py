"""Test the surah extraction regex on known captions."""
import re, sys
sys.path.insert(0, "scripts")

ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

def normalise(text):
    return text.translate(ARABIC_DIGITS)

def extract_surah_ayah(caption):
    if not caption:
        return None
    clean = re.sub(r'[*_`()\[\]]', ' ', caption)
    clean = re.sub(r'\s+', ' ', clean).strip()

    m = re.search(r'سورة\s+(.+)', clean)
    if not m:
        return None

    rest = m.group(1).strip()
    digit_m = re.search(r'[\d٠-٩]', rest)
    if digit_m:
        surah_raw = rest[:digit_m.start()].strip().strip('من').strip()
        digits_part = rest[digit_m.start():]

        range_m = re.match(r'([\d٠-٩]+)\s*[-–]\s*([\d٠-٩]+)', digits_part)
        if range_m:
            start = normalise(range_m.group(1))
            end   = normalise(range_m.group(2))
            if surah_raw:
                return f"سورة {surah_raw} — الآية {start}–{end}"

        single_m = re.match(r'([\d٠-٩]+)', digits_part)
        if single_m:
            ayah = normalise(single_m.group(1))
            if surah_raw:
                return f"سورة {surah_raw} — الآية {ayah}"

    name = re.split(r'[\n\r\u1200-\u137F]', rest)[0].strip().strip('من').strip()
    if name and len(name) <= 30:
        return f"سورة {name}"
    return None

# Test cases
tests = [
    # Caption for lesson 230 — bold markers around the range
    "(**سورة إبراهيم ٢٤ - **٣٤)",
    # No parens
    "سورة إبراهيم ٢٤ - ٣٤",
    # Western digits
    "سورة البقرة 1-13",
    # آل عمران with range
    "سورة آل عمران من الآية ١ - ١١",
    # Just surah name
    "سورة الفاتحة",
    # With من prefix
    "سورة المائدة من الآية ٣ - ٤",
]

for t in tests:
    result = extract_surah_ayah(t)
    print(f"INPUT : {t}")
    print(f"OUTPUT: {result}")
    print()
