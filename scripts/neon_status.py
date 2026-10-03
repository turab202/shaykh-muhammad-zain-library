"""Quick Neon DB status check."""
import os, psycopg2

NEON = "postgresql://neondb_owner:npg_rf3wYTZ7EDVa@ep-damp-haze-b1r8bscu-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=disable"
conn = psycopg2.connect(NEON, connect_timeout=30)
cur = conn.cursor()

for table, col in [
    ("lessons",           "status"),
    ("series",            "status"),
    ("books",             "status"),
    ("categories",        None),
    ("telegram_messages", "processedAt"),
    ("media",             None),
]:
    cur.execute(f'SELECT COUNT(*) FROM {table}')
    total = cur.fetchone()[0]
    if col == "status":
        cur.execute(f"SELECT status, COUNT(*) FROM {table} GROUP BY status")
        breakdown = ", ".join(f"{r[0]}:{r[1]}" for r in cur.fetchall())
        print(f"  {table:<22} {total:>5}  ({breakdown})")
    elif col == "processedAt":
        cur.execute(f'SELECT COUNT(*) FROM {table} WHERE "processedAt" IS NULL')
        pending = cur.fetchone()[0]
        print(f"  {table:<22} {total:>5}  (pending={pending} processed={total-pending})")
    else:
        print(f"  {table:<22} {total:>5}")

conn.close()
