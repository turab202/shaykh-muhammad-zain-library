"""Find and remove ALL lessons with fake Wikipedia/placeholder audio URLs."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

# Find any media records with external placeholder URLs (not b2/local)
cur.execute("""
    SELECT m.id, m."storageKey", m."mediaType",
           l.slug, l.title, l.status
    FROM media m
    LEFT JOIN lessons l ON m."lessonId" = l.id
    WHERE m."storageKey" LIKE 'https://upload.wikimedia.org%%'
       OR m."storageKey" LIKE 'https://www.learningcontainer.com%%'
       OR m."storageKey" LIKE 'https://sample-videos.com%%'
    ORDER BY l.slug
""")
rows = cur.fetchall()
print(f"Found {len(rows)} fake/placeholder media records:")
for r in rows:
    print(f"  lesson={r[3]} | status={r[5]} | key={r[1][:60]}")

if rows:
    media_ids = [r[0] for r in rows]
    lesson_ids_with_fake = []
    
    # Get lesson IDs for these media records
    cur.execute("""
        SELECT DISTINCT "lessonId" FROM media
        WHERE id = ANY(%s) AND "lessonId" IS NOT NULL
    """, (media_ids,))
    lesson_ids_with_fake = [r[0] for r in cur.fetchall()]
    
    # Delete fake media
    cur.execute("DELETE FROM media WHERE id = ANY(%s)", (media_ids,))
    print(f"\nDeleted {len(rows)} fake media records.")
    
    # Set those lessons to DRAFT
    if lesson_ids_with_fake:
        cur.execute("""
            UPDATE lessons SET status='DRAFT'
            WHERE id = ANY(%s) AND "telegramSourceId" IS NULL
            RETURNING slug, status
        """, (lesson_ids_with_fake,))
        updated = cur.fetchall()
        for u in updated:
            print(f"  Set to DRAFT: {u[0]}")
    
    conn.commit()
    print("\n✓ Cleanup complete.")
else:
    print("No fake media found — all clean.")

cur.close()
conn.close()
