import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

/**
 * Single Prisma client — the one entry point for all DB access (Principle V).
 *
 * Prisma 7 requires a driver adapter; we build the pg adapter from the
 * startup-validated DATABASE_URL. A globalThis cache avoids exhausting database
 * connections under Next.js dev hot-reload.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(env.DATABASE_URL) });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
