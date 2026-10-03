import "dotenv/config";
import { defineConfig } from "prisma/config";

// Strip params that Prisma 7 doesn't support (channel_binding, schema, etc.)
// while keeping sslmode which is required for Neon.
function cleanDatabaseUrl(raw: string | undefined): string {
  if (!raw) throw new Error("DATABASE_URL is not set");
  try {
    const url = new URL(raw);
    // Remove unsupported params — keep only sslmode
    const sslmode = url.searchParams.get("sslmode");
    url.search = "";
    if (sslmode) url.searchParams.set("sslmode", sslmode);
    return url.toString();
  } catch {
    return raw; // not a valid URL — return as-is and let Prisma error
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: cleanDatabaseUrl(process.env.DATABASE_URL),
  },
});
