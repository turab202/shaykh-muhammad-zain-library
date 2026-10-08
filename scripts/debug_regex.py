import re

caption = "(**سورة إبراهيم ٢٤ - **٣٤)"
clean = re.sub(r'[*_`()\[\]]', ' ', caption)
clean = re.sub(r'\s+', ' ', clean).strip()
print(f"clean: [{clean}]")
print(f"clean bytes: {clean.encode('utf-8').hex()}")

m = re.search(r'سورة\s+(.+)', clean)
if m:
    rest = m.group(1).strip()
    print(f"rest: [{rest}]")
    digit_m = re.search(r'[\d٠-٩]', rest)
    if digit_m:
        print(f"digit found at pos {digit_m.start()}: [{rest[digit_m.start()]}]")
        surah_raw = rest[:digit_m.start()].strip().strip('من').strip()
        print(f"surah_raw: [{surah_raw}]")
        print(f"surah_raw chars: {[hex(ord(c)) for c in surah_raw]}")
