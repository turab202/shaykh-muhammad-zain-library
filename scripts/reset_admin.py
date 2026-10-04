"""Reset/create admin user. Usage: py scripts/reset_admin.py"""
import bcrypt, secrets, time
from _neon import connect

EMAIL    = "admin@library.local"
PASSWORD = "Admin2026!"

conn = connect()
cur  = conn.cursor()
h    = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(12)).decode()

cur.execute("SELECT id FROM users WHERE email = %s", (EMAIL,))
if cur.fetchone():
    cur.execute("UPDATE users SET \"passwordHash\"=%s WHERE email=%s", (h, EMAIL))
    print(f"✓ Password updated")
else:
    uid = f"c{int(time.time()*1000):x}{secrets.token_urlsafe(12)}"[:25]
    cur.execute(
        "INSERT INTO users (id,email,name,\"passwordHash\",role,\"createdAt\",\"updatedAt\") VALUES (%s,%s,'Admin',%s,'ADMIN',NOW(),NOW())",
        (uid, EMAIL, h),
    )
    print(f"✓ Admin user created")

conn.commit()
conn.close()
print(f"\n  Email   : {EMAIL}")
print(f"  Password: {PASSWORD}")
print(f"  Login   : https://shaykh-muhammad-zain-library.vercel.app/en/login")
