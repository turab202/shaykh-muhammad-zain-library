"""Check Neon DB tables. Usage: py scripts/check_neon.py"""
from _neon import connect

conn = connect(); cur = conn.cursor()
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables ({len(tables)}): {', '.join(tables)}")
conn.close()
