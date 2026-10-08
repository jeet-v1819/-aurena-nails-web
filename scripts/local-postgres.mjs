#!/usr/bin/env node
/**
 * Local PostgreSQL server for development (no Docker, no system packages).
 *
 *   npm run db:local:start     start on port 5432 and print the DATABASE_URL
 *   npm run db:local:stop      stop the server
 *
 * The data lives in `./.local-postgres/data` (git-ignored). This is the *real*
 * PostgreSQL — the exact engine Neon runs — so the schema, migrations and
 * queries behave identically to production. Prefer Neon itself in production.
 */
import path from "node:path";
import process from "node:process";
import EmbeddedPostgres from "embedded-postgres";
import { loadEnv } from "./load-env.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, ".local-postgres", "data");
const PORT = Number(process.env.LOCAL_PG_PORT || 5432);
const USER = "aurena";
const PASSWORD = "aurena";
const DATABASE = "aurena_nails";

const action = process.argv[2] || "start";

const postgres = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
  onLog: (message) => {
    if (process.env.LOCAL_PG_VERBOSE === "1") console.log(`[postgres] ${message}`);
  },
  onError: (error) => console.error(`[postgres] ${error}`),
});

async function start() {
  console.log(`[db:local] starting PostgreSQL in ${DATA_DIR} …`);
  await postgres.initialise();
  await postgres.start();

  try {
    await postgres.createDatabase(DATABASE);
    console.log(`[db:local] created database "${DATABASE}"`);
  } catch {
    // Already exists — that is the normal case on every restart.
  }

  loadEnv({ cwd: ROOT });
  const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public`;
  console.log(`[db:local] READY — listening on port ${PORT}`);
  console.log(`[db:local] DATABASE_URL="${url}"`);
  if (!process.env.DATABASE_URL) {
    console.log(`[db:local] note: DATABASE_URL is not set in .env — copy the line above into it.`);
  }

  const shutdown = async (signal) => {
    console.log(`[db:local] ${signal} received — stopping PostgreSQL …`);
    await postgres.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function stop() {
  console.log("[db:local] stopping PostgreSQL …");
  await postgres.stop().catch(() => {});
  console.log("[db:local] stopped");
  process.exit(0);
}

if (action === "stop") {
  await stop();
} else {
  await start();
}
