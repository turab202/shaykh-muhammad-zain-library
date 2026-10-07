"""
Fix placeholder Al-Ajrumiyyah lessons:
- al-ajrumiyyah-01 and al-ajrumiyyah-02 are seed/test data with fake Wikipedia audio URLs.
- The real lessons (al-ajrumiyyah-0001-rfz7rx, etc.) exist with proper Telegram sources.
- This script:
  1. Shows the current state
  2. Removes the fake media records from the placeholder lessons
  3. Sets the placeholder lessons to DRAFT (or deletes them — user's choice)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

placeholder_slugs = ['al-ajrumiyyah-01', 'al-ajrumiyyah-02']

print("Current placeholder lessons:")
cur.execute("""
    SELECT l.id, l.slug, l.title, l.status, l.duration, l."telegramSourceId",
           m.id as media_id, m."storageKey"
    FROM lessons l
    LEFT JOIN media m ON m."lessonId" = l.id
    WHERE l.slug = ANY(%s)
""", (placeholder_slugs,))
rows = cur.fetchall()
for r in rows:
    print(f"  {r[1]} | status={r[3]} | dur={r[4]}s | tg={r[5]} | media={r[7]}")

print()

# Step 1: Delete the fake media records
print("Removing fake media records from placeholder lessons...")
cur.execute("""
    SELECT l.id FROM lessons l WHERE l.slug = ANY(%s)
""", (placeholder_slugs,))
lesson_ids = [r[0] for r in cur.fetchall()]

if lesson_ids:
    cur.execute("""
        DELETE FROM media
        WHERE "lessonId" = ANY(%s)
          AND "storageKey" LIKE 'https://upload.wikimedia.org%%'
        RETURNING id, "storageKey"
    """, (lesson_ids,))
    deleted = cur.fetchall()
    for d in deleted:
        print(f"  Deleted media id={d[0][:12]}... key={d[1][:60]}")

# Step 2: Set placeholder lessons to DRAFT (hide from public)
print("\nSetting placeholder lessons to DRAFT...")
cur.execute("""
    UPDATE lessons SET status='DRAFT' WHERE slug = ANY(%s)
    RETURNING slug, status
""", (placeholder_slugs,))
updated = cur.fetchall()
for u in updated:
    print(f"  {u[0]} → {u[1]}")

conn.commit()
print("\n✓ Done. Placeholder lessons hidden, fake media removed.")
print("  Real Al-Ajrumiyyah lessons (0001-rfz7rx etc.) now shown correctly.")

# Show final state
print("\nFinal Al-Ajrumiyyah lesson count (PUBLISHED):")
cur.execute("""
    SELECT COUNT(*) FROM lessons l
    JOIN series s ON l."seriesId" = s.id
    WHERE s.slug = 'al-ajrumiyyah' AND l.status = 'PUBLISHED'
""")
r = cur.fetchone()
print(f"  {r[0]} published lessons in Al-Ajrumiyyah series")

cur.close()
conn.close()
