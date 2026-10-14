# -*- coding: utf-8 -*-
"""Find unprocessed/unpublished telegram messages that match known series patterns."""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Find messages that are in telegram_messages but either:
# 1. Have no lesson linked
# 2. Have a lesson but it's DRAFT
# And match Al-Qawl al-Mufid or other series patterns

SERIES_PATTERNS = {
    'al-qawl-al-mufid': ['القول المفيد', 'القول_المفيد', 'كتاب التوحيد', 'مفيد'],
    'riyad-as-salihin': ['رياض الصالحين', 'رياض_الصالحين'],
    'sunan-ibn-majah': ['سنن ابن ماجه', 'سنن_ابن_ماجه'],
    'al-aqeedah-al-wasitiyyah': ['الواسطية', 'العقيدة الواسطية'],
    'al-ajrumiyyah': ['الآجرومية', 'الجرومية', 'متن الآجرومية'],
}

for series_slug, patterns in SERIES_PATTERNS.items():
    conditions = " OR ".join(
        [f'tm."audioFilename" ILIKE \'%%{p}%%\'' for p in patterns] +
        [f'tm.caption ILIKE \'%%{p}%%\'' for p in patterns]
    )
    cur.execute(f"""
        SELECT tm."messageId", tm."audioFilename",
               l.id, l."lessonNumber", l.status
        FROM telegram_messages tm
        LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
        WHERE tm."chatId" = '1747155048'
          AND ({conditions})
        ORDER BY tm."messageId"
    """)
    rows = cur.fetchall()
    unlinked = [r for r in rows if r[2] is None]
    draft = [r for r in rows if r[2] and r[4] == 'DRAFT']
    published = [r for r in rows if r[2] and r[4] == 'PUBLISHED']

    print(f"\n{series_slug}:")
    print(f"  Published: {len(published)}, Draft/hidden: {len(draft)}, NOT LINKED: {len(unlinked)}")
    if unlinked:
        print(f"  Unlinked messages (not yet imported as lessons):")
        for r in unlinked[:10]:
            print(f"    msgId={r[0]}  file={str(r[1] or '')[:50]}")
    if draft:
        print(f"  Draft lessons (hidden):")
        for r in draft[:5]:
            print(f"    msgId={r[0]}  #{r[3]}  {r[4]}")

cur.close()
conn.close()
