"""Delete seed sample lessons and media so real content can replace them."""
import psycopg2, os
from dotenv import load_dotenv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
cur = conn.cursor()

# Delete seed media records (they all have id starting with 'media-audio-')
cur.execute("DELETE FROM media WHERE id LIKE 'media-audio-%'")
print(f"Deleted {cur.rowcount} seed media records")

# Delete seed lessons (slugs end with -01 or -02 and are from the seed series)
seed_prefixes = (
    "riyad-as-salihin-0",
    "tafsir-ibn-kathir-0",
    "al-aqeedah-al-wasitiyyah-0",
    "al-ajrumiyyah-0",
)
for prefix in seed_prefixes:
    cur.execute("DELETE FROM lessons WHERE slug LIKE %s", (prefix + "%",))
    print(f"  Deleted {cur.rowcount} lessons with prefix '{prefix}'")

conn.commit()
cur.execute("SELECT COUNT(*) FROM lessons")
print(f"Remaining lessons: {cur.fetchone()[0]}")
conn.close()
print("Done — seed data removed.")
