"""Check the exact bytes of the caption for lesson 230."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()
cur.execute("""
    SELECT ts.caption
    FROM telegram_messages ts
    WHERE ts."messageId" = 3333
""")
row = cur.fetchone()
caption = row[0]

# Find the سورة line
import re
for line in caption.split('\n'):
    if 'سورة' in line:
        print(f"Line with surah: [{line}]")
        print(f"Hex: {line.encode('utf-8').hex()}")
        # Show each char
        for i, c in enumerate(line):
            if c != ' ':
                print(f"  pos {i}: U+{ord(c):04X} = {c}")

conn.close()
