/**
 * Prisma Client singleton.
 *
 * Prisma 7 has no bundled Rust query engine: the client talks to PostgreSQL
 * through a **driver adapter**, which we build from `DATABASE_URL` with
 * `@prisma/adapter-pg` (a real `pg` connection pool — perfect for Neon's pooled
 * connection string).
 *
 * On a serverless host (Vercel/Netlify) many instances share one database, so
 * the pool is kept deliberately small. In development the client is cached on
 * `globalThis` to survive hot reloads instead of leaking a pool per reload.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string."
  );
}

/** Neon (and every hosted Postgres) terminates TLS; local Postgres does not. */
const needsSsl = /sslmode=(require|verify-full|verify-ca)/.test(connectionString);

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { __aurenaPrisma?: PrismaClient };

export const prisma = globalForPrisma.__aurenaPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__aurenaPrisma = prisma;
}

export default prisma;
