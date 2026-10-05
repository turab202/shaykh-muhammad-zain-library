"""Show what's pending and why it wasn't auto-published."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect(); cur = conn.cursor()

# Total messages vs processed
cur.execute("SELECT COUNT(*) FROM telegram_messages WHERE \"chatId\"='1747155048'")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM telegram_messages WHERE \"chatId\"='1747155048' AND \"processedAt\" IS NOT NULL")
processed = cur.fetchone()[0]
print(f"Total channel messages: {total}")
print(f"Processed (published): {processed}")
print(f"Pending: {total - processed}\n")

# Why pending — confidence breakdown
cur.execute("""
    SELECT
        CASE
            WHEN (\"suggestedMetadata\"->>'confidence')::float >= 0.6 AND \"suggestedMetadata\"->>'series_slug' IS NOT NULL THEN 'ready_to_publish'
            WHEN (\"suggestedMetadata\"->>'confidence')::float >= 0.6 THEN 'no_series_detected'
            ELSE 'low_confidence'
        END as reason,
        COUNT(*) as cnt
    FROM telegram_messages
    WHERE \"chatId\"='1747155048' AND \"processedAt\" IS NULL
    GROUP BY 1 ORDER BY 2 DESC
""")
print("Pending breakdown:")
for r in cur.fetchall():
    print(f"  {r[0]:<30} {r[1]:>5}")

# Show series distribution of pending publishable ones
cur.execute("""
    SELECT \"suggestedMetadata\"->>'series_slug' as series, COUNT(*) as cnt
    FROM telegram_messages
    WHERE \"chatId\"='1747155048' AND \"processedAt\" IS NULL
      AND \"suggestedMetadata\"->>'series_slug' IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC
""")
print("\nPending by series (publishable):")
for r in cur.fetchall():
    print(f"  {str(r[0]):<35} {r[1]:>5}")

conn.close()
