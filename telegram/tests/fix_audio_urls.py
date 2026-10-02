"""Fix seed lesson audio URLs — replace broken soundhelix with working Wikimedia Commons audio."""
import psycopg2, os
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
cur = conn.cursor()

URLS = [
    ("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
     "https://upload.wikimedia.org/wikipedia/commons/4/4e/BWV_543-fugue.ogg"),
    ("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
     "https://upload.wikimedia.org/wikipedia/commons/6/6e/Micronesia_National_Anthem.ogg"),
    ("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
     "https://upload.wikimedia.org/wikipedia/commons/3/3e/Chopin_-_Nocturne_op_9_no_1.ogg"),
]

total = 0
for old, new in URLS:
    cur.execute('UPDATE media SET "storageKey" = %s WHERE "storageKey" = %s', (new, old))
    total += cur.rowcount
    print(f"  {cur.rowcount} rows: {old[:50]} → {new[:50]}")

conn.commit()
print(f"\nUpdated {total} media records.")
conn.close()
