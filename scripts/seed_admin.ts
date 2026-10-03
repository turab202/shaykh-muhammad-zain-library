/**
 * Seeds only the admin user — safe to run on production Neon.
 * Run via: npx tsx scripts/seed_admin.ts
 *
 * Set these env vars before running:
 *   DATABASE_URL   — Neon connection string
 *   ADMIN_EMAIL    — admin email (default: admin@library.local)
 *   ADMIN_PASSWORD — admin password (default: change-me-immediately)
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@library.local";
  const password = process.env.ADMIN_PASSWORD ?? "change-me-immediately";
  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Admin", passwordHash: hash, role: "ADMIN" },
  });

  console.log(`✓ Admin user ready: ${user.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
