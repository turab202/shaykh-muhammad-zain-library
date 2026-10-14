# -*- coding: utf-8 -*-
"""
Analyze all 1706 unlinked TG messages — group by filename pattern to discover series.
"""
import sys, re
from pathlib import Path
from collections import Counter, defaultdict
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

cur.execute("""
    SELECT tm."messageId", tm."audioFilename", tm."caption"
    FROM telegram_messages tm
    LEFT JOIN lessons l ON l."telegramSourceId" = tm.id
    WHERE tm."chatId" = '1747155048'
      AND tm."audioFilename" IS NOT NULL
      AND l.id IS NULL
    ORDER BY tm."messageId"
""")
rows = cur.fetchall()

# Strip leading number + separator to get the "series name" part
def extract_series_name(filename):
    if not filename:
        return 'UNKNOWN'
    fn = str(filename)
    # Remove extension
    fn = re.sub(r'\.(mp3|m4a|ogg|wav|flac)$', '', fn, flags=re.IGNORECASE)
    # Remove leading number patterns: "123 - ", "123_", "123. "
    fn = re.sub(r'^\d+\s*[-_.]\s*', '', fn)
    fn = fn.strip()
    return fn

# Group by normalized series name
groups = defaultdict(list)
for msgId, filename, caption in rows:
    # More aggressive normalization — strip number from start
    fn = str(filename) if filename else ''
    # Remove ext
    base = re.sub(r'\.(mp3|m4a|ogg|wav|flac)$', '', fn, flags=re.IGNORECASE)
    # Remove number prefix
    base = re.sub(r'^\d+\s*[-_. ]+\s*', '', base).strip()
    groups[base].append(msgId)

# Show groups with more than 2 items (likely a series)
print(f"Total unlinked messages: {len(rows)}")
print(f"Distinct filename patterns: {len(groups)}")
print()
print("Patterns with 3+ messages (likely series — SORTED BY COUNT):")
print("="*70)
sorted_groups = sorted(groups.items(), key=lambda x: -len(x[1]))
for name, ids in sorted_groups:
    if len(ids) >= 3:
        print(f"\n[{len(ids):3d} msgs]  {name[:65]}")
        print(f"  msgIds: {ids[0]} to {ids[-1]}  |  sample: {ids[:5]}")

print()
print("Single or pair messages (likely PDFs or one-offs):")
singles = [(name, ids) for name, ids in sorted_groups if len(ids) < 3]
print(f"  {len(singles)} patterns with <3 messages")

cur.close()
conn.close()
