"""
Diagnose audio playback issues:
1. Check Tafsir-230 media record (should have B2 storageKey)
2. Check Al-Ajrumiyyah lessons — why do they have duration but no audio?
3. Global coverage stats
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

print("=" * 60)
print("1. TAFSIR-230 — media record")
print("=" * 60)

cur.execute("""
    SELECT l.id, l.slug, l.title, l.duration, l."lessonNumber",
           l."telegramSourceId",
           ts."messageId" AS tg_message_id,
           m."storageKey", m."mediaType", m.filename
    FROM lessons l
    LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id
    WHERE l."lessonNumber" = 230
      AND l.status = 'PUBLISHED'
    ORDER BY l."lessonNumber"
    LIMIT 10
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  id={r[0][:12]}..., slug={r[1]}")
        print(f"  title={r[2]}")
        print(f"  duration={r[3]}s, lessonNumber={r[4]}")
        print(f"  telegramSourceId={str(r[5])[:12] if r[5] else None}")
        print(f"  tg_message_id={r[6]}")
        print(f"  storageKey={r[7]}")
        print(f"  mediaType={r[8]}, filename={r[9]}")
        print()
else:
    print("  No published lesson with lessonNumber=230")

# Also look for msgId 3333
print("  Telegram_message with messageId=3333:")
cur.execute("""
    SELECT ts.id, ts."messageId", ts."chatId",
           l.id AS lesson_id, l.slug, l."lessonNumber", l.status,
           m."storageKey", m."mediaType"
    FROM telegram_messages ts
    LEFT JOIN lessons l ON l."telegramSourceId" = ts.id
    LEFT JOIN media m ON m."lessonId" = l.id
    WHERE ts."messageId" = 3333
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  ts.id={str(r[0])[:12]}..., messageId={r[1]}, chatId={r[2]}")
        print(f"  lesson_id={str(r[3])[:12] if r[3] else None}, slug={r[4]}, lessonNumber={r[5]}, status={r[6]}")
        print(f"  storageKey={r[7]}, mediaType={r[8]}")
else:
    print("  NOT FOUND")


print()
print("=" * 60)
print("2. AL-AJRUMIYYAH — series/book lookup")
print("=" * 60)

cur.execute("""
    SELECT id, slug, title FROM series
    WHERE slug ILIKE '%ajrumiy%' OR slug ILIKE '%jurumiy%'
       OR title ILIKE '%جرومي%' OR title ILIKE '%آجرومي%'
""")
series_rows = cur.fetchall()
print(f"  Series: {[(r[1], r[2]) for r in series_rows]}")

cur.execute("""
    SELECT id, slug, title FROM books
    WHERE slug ILIKE '%ajrumiy%' OR slug ILIKE '%jurumiy%'
       OR title ILIKE '%جرومي%' OR title ILIKE '%آجرومي%'
""")
book_rows = cur.fetchall()
print(f"  Books: {[(r[1], r[2]) for r in book_rows]}")

series_ids = [r[0] for r in series_rows]
book_ids   = [r[0] for r in book_rows]

if series_ids or book_ids:
    conditions = []
    params = []
    if series_ids:
        conditions.append('l."seriesId" = ANY(%s)')
        params.append(series_ids)
    if book_ids:
        conditions.append('l."bookId" = ANY(%s)')
        params.append(book_ids)
    where = " OR ".join(conditions)

    cur.execute(f"""
        SELECT l.id, l.slug, l.title, l.duration, l."lessonNumber",
               l."telegramSourceId",
               ts."messageId" AS tg_message_id,
               COUNT(m.id) AS media_count,
               MAX(m."storageKey") AS storage_key
        FROM lessons l
        LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
        LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
        WHERE ({where}) AND l.status = 'PUBLISHED'
        GROUP BY l.id, l.slug, l.title, l.duration, l."lessonNumber",
                 l."telegramSourceId", ts."messageId"
        ORDER BY l."lessonNumber" NULLS LAST
        LIMIT 30
    """, params)
    rows = cur.fetchall()
    print(f"\n  Found {len(rows)} Al-Ajrumiyyah published lessons:")
    for r in rows:
        if r[7] > 0:
            status = f"HAS MEDIA: {r[8]}"
        elif r[6]:
            status = f"No media, has TG msg_id={r[6]}"
        else:
            status = "NO AUDIO"
        print(f"  [{r[3]}s] #{r[4]:>3}  {r[1][:50]}  | {status}")
else:
    print("\n  No series/book found, doing title search...")
    cur.execute("""
        SELECT l.id, l.slug, l.title, l.duration, l."lessonNumber",
               ts."messageId",
               COUNT(m.id) AS media_count
        FROM lessons l
        LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
        LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
        WHERE (l.title ILIKE '%جرومي%' OR l.title ILIKE '%آجرومي%'
               OR l.slug ILIKE '%jurumiy%' OR l.slug ILIKE '%ajrumiy%')
          AND l.status = 'PUBLISHED'
        GROUP BY l.id, l.slug, l.title, l.duration, l."lessonNumber", ts."messageId"
        LIMIT 30
    """)
    rows2 = cur.fetchall()
    print(f"  Found {len(rows2)} lessons by title search:")
    for r in rows2:
        status = "NO AUDIO" if r[6] == 0 and not r[5] else \
                 f"TG only msg_id={r[5]}" if r[6] == 0 else "HAS MEDIA"
        print(f"  [{r[3]}s] #{r[4]:>3}  {r[1][:50]}  | {status}")


print()
print("=" * 60)
print("3. GLOBAL audio coverage stats")
print("=" * 60)

cur.execute("""
    SELECT
        COUNT(DISTINCT l.id)                                                            AS total_published,
        COUNT(DISTINCT CASE WHEN m.id IS NOT NULL THEN l.id END)                        AS has_audio_media,
        COUNT(DISTINCT CASE WHEN m."storageKey" LIKE 's3://%' THEN l.id END)            AS has_b2,
        COUNT(DISTINCT CASE WHEN ts."messageId" IS NOT NULL AND m.id IS NULL THEN l.id END)  AS tg_only,
        COUNT(DISTINCT CASE WHEN ts."messageId" IS NULL AND m.id IS NULL THEN l.id END) AS no_audio
    FROM lessons l
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    LEFT JOIN telegram_messages ts ON l."telegramSourceId" = ts.id
    WHERE l.status = 'PUBLISHED'
""")
r = cur.fetchone()
total = r[0] or 1
print(f"  Total published lessons : {r[0]}")
print(f"  Has audio media record  : {r[1]}  ({r[1]/total*100:.1f}%)")
print(f"  Has B2 storageKey       : {r[2]}  ({r[2]/total*100:.1f}%)")
print(f"  Telegram-only (no file) : {r[3]}  ({r[3]/total*100:.1f}%)")
print(f"  NO audio at all         : {r[4]}  ({r[4]/total*100:.1f}%)")


print()
print("=" * 60)
print("4. Lessons with duration>0 but no telegramSource AND no media")
print("=" * 60)

cur.execute("""
    SELECT COUNT(*)
    FROM lessons l
    LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
    WHERE l.status = 'PUBLISHED'
      AND l.duration > 0
      AND l."telegramSourceId" IS NULL
      AND m.id IS NULL
""")
r = cur.fetchone()
print(f"  Count: {r[0]}")
if r[0] > 0:
    cur.execute("""
        SELECT l.slug, l.title, l.duration, l."lessonNumber"
        FROM lessons l
        LEFT JOIN media m ON m."lessonId" = l.id AND m."mediaType" = 'AUDIO'
        WHERE l.status = 'PUBLISHED'
          AND l.duration > 0
          AND l."telegramSourceId" IS NULL
          AND m.id IS NULL
        LIMIT 10
    """)
    for r in cur.fetchall():
        print(f"  dur={r[2]}s | #{r[3]} {r[0]}")


cur.close()
conn.close()
print("\nDone.")
