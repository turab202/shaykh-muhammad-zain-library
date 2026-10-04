"""Setup Neon: check tables + create admin. Usage: py scripts/setup_neon.py"""
import bcrypt, secrets, time
from _neon import connect

conn = connect(); cur = conn.cursor()
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables: {len(tables)}")
if not tables:
    print("No tables — run prisma migrate deploy first"); raise SystemExit(1)

EMAIL = "admin@library.local"; PASSWORD = "Admin2026!"
cur.execute("SELECT id FROM users WHERE email=%s", (EMAIL,))
if not cur.fetchone():
    h = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(12)).decode()
    uid = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(12)}"[:25]
    cur.execute("INSERT INTO users (id,email,name,\"passwordHash\",role,\"createdAt\",\"updatedAt\") VALUES (%s,%s,'Admin',%s,'ADMIN',NOW(),NOW())", (uid,EMAIL,h))
    conn.commit()
    print(f"✓ Admin created: {EMAIL} / {PASSWORD}")
else:
    print(f"✓ Admin exists: {EMAIL}")
conn.close()
