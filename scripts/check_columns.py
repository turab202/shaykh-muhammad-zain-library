"""Check actual column names in DB tables"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect()
cur = conn.cursor()

for table in ['lessons', 'telegram_messages', 'media']:
    print(f"\n-- {table} columns:")
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position
    """, (table,))
    for row in cur.fetchall():
        print(f"  {row[0]:35} {row[1]}")

cur.close()
conn.close()
