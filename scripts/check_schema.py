# -*- coding: utf-8 -*-
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _neon import connect

conn = connect(); cur = conn.cursor()

cur.execute("SELECT id, slug, name FROM categories ORDER BY slug")
print("Categories:")
for r in cur.fetchall():
    print(f"  {r[0]}  {r[1]}  {r[2]}")

cur.execute("SELECT DISTINCT status FROM series")
print("\nSeries status values:", [r[0] for r in cur.fetchall()])

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'lessons' ORDER BY ordinal_position")
print("\nLessons columns:", [r[0] for r in cur.fetchall()])

# Show a sample series row
cur.execute("SELECT id, slug, title, status, \"categoryId\" FROM series LIMIT 3")
print("\nSample series rows:")
for r in cur.fetchall():
    print(f"  {r}")

cur.close(); conn.close()
