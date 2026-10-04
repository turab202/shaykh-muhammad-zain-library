import psycopg2
NEON = "postgresql://neondb_owner:npg_rf3wYTZ7EDVa@ep-damp-haze-b1r8bscu-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=disable"
conn = psycopg2.connect(NEON, connect_timeout=20)
cur = conn.cursor()
cur.execute("SELECT slug, title, status FROM books ORDER BY title")
print("Books:")
for r in cur.fetchall(): print(f"  [{r[2]}] {r[0]}")
cur.execute("SELECT slug, title, status FROM series ORDER BY \"order\"")
print("\nSeries:")
for r in cur.fetchall(): print(f"  [{r[2]}] {r[0]}")
cur.execute("SELECT slug, name FROM categories ORDER BY name")
print("\nCategories:")
for r in cur.fetchall(): print(f"  {r[0]}")
conn.close()
