import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function poolSize() {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 25;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const pool = globalForPrisma.pgPool ?? new Pool({
    connectionString,
    min: 2,
    // Keep instances * DATABASE_POOL_MAX below the database's max_connections.
    max: poolSize(),
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
  });
  if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
