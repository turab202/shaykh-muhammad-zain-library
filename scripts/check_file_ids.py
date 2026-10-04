import psycopg2
NEON = "postgresql://neondb_owner:npg_rf3wYTZ7EDVa@ep-damp-haze-b1r8bscu-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=disable"
conn = psycopg2.connect(NEON, connect_timeout=20)
cur = conn.cursor()
cur.execute("""
    SELECT "messageId", "telegramFileId", "audioFilename"
    FROM telegram_messages
    WHERE "chatId" = '1747155048'
      AND "telegramFileId" IS NOT NULL
    ORDER BY "messageId" DESC LIMIT 5
""")
for r in cur.fetchall():
    fid = str(r[1])
    print(f"msgId={r[0]}  fileId={fid[:35]:35}  file={str(r[2] or '')[:45]}")
conn.close()
