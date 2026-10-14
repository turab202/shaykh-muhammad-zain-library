# -*- coding: utf-8 -*-
"""Show unique unmatched filename patterns to add to MATCH_RULES."""
import sys, re
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

# Import the matcher to find what's NOT matched
sys.path.insert(0, str(Path(__file__).parent))

# Inline the match logic
MATCH_RULES = [
    ("riyad-as-salihin",        ["رياض الصالحين", "رياض_الصالحين"]),
    ("bulugh-al-maram",         ["بلوغ المرام", "بلوغ_المرام"]),
    ("sunan-ibn-majah",         ["سنن ابن ماجه", "سنن_ابن_ماجه", "ابن ماجه", "ابن_ماجه"]),
    ("sunan-al-nasai",          ["سنن النسائي", "سنن_النسائي", "النسائي"]),
    ("mustalah-al-hadith",      ["مصطلح الحديث", "مصطلح_الحديث"]),
    ("tafsir-al-saadi",         ["تفسير السعدي", "تفسير_السعدي", "تفسير_سورة", "تفسير سورة"]),
    ("muqaddimah-al-tafsir",    ["مقدمة التفسير", "مقدمة_التفسير", "مقدمة في التفسير",
                                  "شرح مقدمة التفسير", "شرح_مقدمة_التفسير"]),
    ("usool-fi-at-tafseer",     ["أصول في التفسير", "أصول_في_التفسير"]),
    ("al-qawaaid-al-hisaan",    ["القواعد الحسان", "القواعد_الحسان"]),
    ("ar-raheeq-al-makhtum",    ["الرحيق المختوم", "الرحيق_المختوم"]),
    ("al-aqeedah-al-wasitiyyah",["العقيدة الواسطية", "الواسطية"]),
    ("sharh-al-aqeedah-al-tahawiyyah", ["العقيدة الطحاوية", "الطحاوية"]),
    ("al-qawl-al-mufid",        ["القول المفيد", "القول_المفيد", "كتاب التوحيد"]),
    ("sharh-masail-al-jahiliyyah", ["مسائل الجاهلية", "مسائل_الجاهلية"]),
    ("daaamim-manhaj-an-nubuwwah", ["دعائم منهاج النبوة", "دعائم_منهاج_النبوة"]),
    ("sharh-kashf-ash-shubuhat",["كشف الشبهات", "كشف_الشبهات"]),
    ("sharh-as-sunnah-al-barbahaariy", ["السنة للبربهاري", "السنة_للبربهاري", "للبربهاري"]),
    ("sharh-usool-as-sunnah",   ["أصول السنة للإمام أحمد", "أصول_السنة_للإمام_أحمد"]),
    ("al-ubudiyyah",            ["العبودية لشيخ الإسلام", "العبودية_لشيخ_الإسلام",
                                  "عبودية_لشيخ_الإسلام"]),
    ("dalal-al-ahbash",         ["ضلال جماعة الأحباش", "ضلال_جماعة_الأحباش", "الأحباش"]),
    ("ad-duroos-al-muhimmah",   ["الدروس المهمة", "الدروس_المهمة"]),
    ("sharh-ibn-aqeel",         ["ابن عقيل على ألفية", "ابن_عقيل_على_ألفية", "شرح ابن عقيل"]),
    ("al-fawakeh-al-janiyyah",  ["الفواكه الجنية", "الفواكه_الجنية"]),
    ("kashf-an-niqab",          ["كشف النقاب", "كشف_النقاب"]),
    ("mulhat-al-iraab",         ["ملحة الإعراب", "ملحة_الإعراب", "ملحة اﻹعراب"]),
    ("al-ajrumiyyah",           ["الآجرومية", "الأجرومية", "أجرومية"]),
    ("mudhakirah-sawm",         ["أحكام الصيام", "أحكام_الصيام"]),
    ("wasaya-luqman",           ["وصايا لقمان", "وصايا_لقمان", "لقمان الحكيم", "لقمان_الحكيم"]),
    ("sunan-abi-dawud",         ["سنن أبي داود", "سنن_أبي_داود", "سنن ابي داود"]),
]

def normalize(s):
    return s.replace("_", " ").lower()

def match_series(filename):
    fn_norm = normalize(filename)
    for slug, patterns in MATCH_RULES:
        for pat in patterns:
            if normalize(pat) in fn_norm:
                return slug
    return None

conn = connect()
cur = conn.cursor()

cur.execute("""
    SELECT tm."messageId", tm."audioFilename"
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE tm."chatId" = '1747155048'
      AND tm."audioFilename" IS NOT NULL
      AND l.id IS NULL
    ORDER BY tm."messageId"
""")
rows = cur.fetchall()

unmatched = []
for msg_id, fn in rows:
    fn_s = str(fn)
    if fn_s.lower().endswith(('.pdf', '.webp', '.apk', '.jpg', '.png')):
        continue
    if not match_series(fn_s):
        unmatched.append((msg_id, fn_s))

print(f"Still unmatched after all rules: {len(unmatched)}")
print()
seen = set()
for msg_id, fn in unmatched:
    base = re.sub(r'^\d+[\s\-_]+', '', fn)
    base = re.sub(r'\.(mp3|m4a|ogg|wav)$', '', base, flags=re.I).strip()[:60]
    if base not in seen:
        seen.add(base)
        print(f"  msgId={msg_id:5d}  {base}")

cur.close()
conn.close()
