import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prevent multiple PrismaClient instances during hot reload in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Strip query params that pg/PrismaPg don't support
 * (channel_binding, schema) while keeping sslmode which Neon requires.
 */
function cleanConnectionString(raw: string | undefined): string {
  if (!raw) throw new Error("DATABASE_URL environment variable is not set.");
  try {
    const url = new URL(raw);
    const sslmode = url.searchParams.get("sslmode");
    url.search = "";
    if (sslmode) url.searchParams.set("sslmode", sslmode);
    return url.toString();
  } catch {
    // Not a valid URL — strip the ?schema=public suffix used locally
    return raw.split("?")[0];
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = cleanConnectionString(process.env.DATABASE_URL);

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
