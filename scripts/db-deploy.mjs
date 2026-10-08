#!/usr/bin/env node
/**
 * Migration deployer — applies the SQL files in `prisma/migrations/` to the
 * database referenced by `DATABASE_URL`.
 *
 * This is a drop-in replacement for `prisma migrate deploy` that needs no
 * native Prisma engine, so it works on every host (including this project's
 * sandbox and engine-less CI images). It keeps the exact same bookkeeping table
 * Prisma uses (`_prisma_migrations`), so the two are interchangeable:
 *
 *     npm run db:deploy           # this script (works everywhere)
 *     npx prisma migrate deploy   # Prisma CLI (needs the downloaded engine)
 *
 * Usage
 *   node scripts/db-deploy.mjs [--reset] [--status]
 *     --reset   drop the `public` schema first, then re-apply everything
 *     --status  only print which migrations are applied / pending
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";
import { loadEnv } from "./load-env.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "prisma", "migrations");

loadEnv({ cwd: ROOT });

const args = new Set(process.argv.slice(2));
const statusOnly = args.has("--status");
const reset = args.has("--reset");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "[db-deploy] DATABASE_URL is not set.\n" +
      "  Local:  cp .env.example .env   (a working local Postgres URL is already filled in)\n" +
      "  Neon:   paste your Neon connection string from https://console.neon.tech"
  );
  process.exit(1);
}

/** Prisma-compatible bookkeeping so the Prisma CLI can take over at any time. */
const MIGRATIONS_TABLE = `"public"."_prisma_migrations"`;

function migrationDirs() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const file = path.join(MIGRATIONS_DIR, name, "migration.sql");
      if (!fs.existsSync(file)) return null;
      const sql = fs.readFileSync(file, "utf8");
      return {
        name,
        sql,
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      };
    })
    .filter(Boolean);
}

function log(message) {
  console.log(`[db-deploy] ${message}`);
}

const client = new Client({
  connectionString,
  // Neon (and most hosted Postgres) requires TLS; local Postgres does not offer it.
  ssl: /sslmode=(require|verify-full|verify-ca)/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
  connectionTimeoutMillis: 15_000,
});

try {
  await client.connect();
  log(`connected to ${connectionString.replace(/:\/\/.*@/, "://***@")}`);

  if (reset) {
    log("--reset: dropping schema public (all Aurena Nails data will be lost)");
    await client.query('DROP SCHEMA IF EXISTS "public" CASCADE');
    await client.query('CREATE SCHEMA "public"');
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      "id"                  VARCHAR(36)  NOT NULL PRIMARY KEY,
      "checksum"            VARCHAR(64)  NOT NULL,
      "finished_at"         TIMESTAMPTZ,
      "migration_name"      VARCHAR(255) NOT NULL,
      "logs"                TEXT,
      "rolled_back_at"      TIMESTAMPTZ,
      "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER      NOT NULL DEFAULT 0
    )
  `);

  const applied = new Set(
    (
      await client.query(
        `SELECT "migration_name" FROM ${MIGRATIONS_TABLE} WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`
      )
    ).rows.map((row) => row.migration_name)
  );

  const migrations = migrationDirs();
  const pending = migrations.filter((migration) => !applied.has(migration.name));

  if (statusOnly) {
    for (const migration of migrations) {
      console.log(`${applied.has(migration.name) ? "  applied" : "  pending"}  ${migration.name}`);
    }
    log(`${applied.size} applied, ${pending.length} pending`);
    process.exit(0);
  }

  if (pending.length === 0) {
    log(`database is up to date (${applied.size} migration${applied.size === 1 ? "" : "s"} applied)`);
    process.exit(0);
  }

  for (const migration of pending) {
    const id = crypto.randomUUID();
    log(`applying ${migration.name} …`);
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} ("id","checksum","migration_name","started_at","applied_steps_count") VALUES ($1,$2,$3,now(),0)`,
      [id, migration.checksum, migration.name]
    );
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query(
        `UPDATE ${MIGRATIONS_TABLE} SET "finished_at" = now(), "applied_steps_count" = 1 WHERE "id" = $1`,
        [id]
      );
      await client.query("COMMIT");
      log(`✔ ${migration.name}`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      await client.query(
        `UPDATE ${MIGRATIONS_TABLE} SET "logs" = $2, "rolled_back_at" = now() WHERE "id" = $1`,
        [id, String(error?.message ?? error)]
      );
      throw error;
    }
  }

  log("done — every migration is applied");
} catch (error) {
  console.error(`[db-deploy] failed: ${error?.message ?? error}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
