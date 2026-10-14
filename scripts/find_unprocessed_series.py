# -*- coding: utf-8 -*-
"""
Find telegram messages that should belong to known series but weren't detected.
Shows message IDs and filenames so we can fix the parser patterns.
"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Search unprocessed/low-confidence messages for known series patterns
SERIES_SEARCHES = {
    'riyad-as-salihin':       ['رياض الصالحين', 'رياض_الصالحين', 'Riyad'],
    'sunan-ibn-majah':        ['سنن ابن ماجه', 'سنن_ابن_ماجه', 'ابن ماجه'],
    'sunan-al-nasai':         ['سنن النسائي', 'سنن_النسائي', 'النسائي'],
    'bulugh-al-maram':        ['بلوغ المرام', 'بلوغ_المرام'],
    'tafsir-al-saadi':        ['تفسير السعدي', 'تفسير_السعدي', 'تفسير_سورة'],
    'al-ajrumiyyah':          ['متن الآجرومية', 'متن_الآجرومية', 'الآجرومية'],
    'mustalah-al-hadith':     ['مصطلح الحديث', 'مصطلح_الحديث'],
    'al-aqeedah-al-wasitiyyah':['الواسطية', 'واسطية'],
}

for series_slug, patterns in SERIES_SEARCHES.items():
    conditions = " OR ".join(
        [f'tm."audioFilename" ILIKE \'%%{p}%%\'' for p in patterns]
    )
    cur.execute(f"""
        SELECT tm."messageId", tm."audioFilename",
               l.id, l.status, l."lessonNumber"
        FROM telegram_messages tm
        LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
        WHERE tm."chatId" = '1747155048'
          AND tm."audioFilename" IS NOT NULL
          AND ({conditions})
        ORDER BY tm."messageId"
    """)
    rows = cur.fetchall()
    published  = [r for r in rows if r[2] and r[3] == 'PUBLISHED']
    draft      = [r for r in rows if r[2] and r[3] == 'DRAFT']
    unlinked   = [r for r in rows if not r[2]]

    if unlinked or draft:
        print(f"\n{series_slug}:")
        print(f"  Published={len(published)} | Draft={len(draft)} | Unlinked={len(unlinked)}")
        if unlinked:
            print(f"  First 5 unlinked (need to be published as lessons):")
            for r in unlinked[:5]:
                print(f"    msgId={r[0]}  {str(r[1])[:55]}")
        if draft:
            print(f"  Draft (hidden — just need status change):")
            for r in draft[:5]:
                print(f"    msgId={r[0]}  #{r[4]}  {str(r[1])[:50]}")

cur.close()
conn.close()
print("\nDone.")
