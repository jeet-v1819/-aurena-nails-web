/**
 * Real Prisma Client singleton for the application.
 *
 * Prisma 7 has no bundled query engine — `PrismaClient` requires a driver
 * adapter. `createPrismaAdapter()` (prisma/adapter.js) picks one from
 * DATABASE_URL so the same code runs on local SQLite and production
 * PostgreSQL/Neon.
 *
 * This module intentionally does NOT contain a hand-rolled/mock Prisma client;
 * it instantiates the real generated client from @prisma/client (produced by
 * `prisma generate` into node_modules/@prisma/client).
 */
import { PrismaClient } from "@prisma/client";
import { createPrismaAdapter, detectProvider, resolveDatabaseUrl } from "../../prisma/adapter.js";

// Keep a single client across Next.js dev hot-reloads, otherwise every reload
// leaks another connection pool.
const globalForPrisma = globalThis;

function buildClient() {
  const url = resolveDatabaseUrl();
  const { adapter } = createPrismaAdapter(url);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" && process.env.PRISMA_LOG === "1" ? ["warn", "error"] : ["error"],
  });
}

let prisma = globalForPrisma.__prisma;

if (!prisma) {
  prisma = buildClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__prisma = prisma;
  }
}

/**
 * The SQL flavour currently in use. SQLite does not support
 * `mode: "insensitive"` on string filters, so query builders branch on this.
 * @returns {"postgresql"|"sqlite"|"unknown"}
 */
export function getDbProvider() {
  return detectProvider(resolveDatabaseUrl());
}

export default prisma;
export { PrismaClient, prisma };
