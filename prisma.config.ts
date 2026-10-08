/**
 * Prisma CLI configuration (Prisma 7).
 *
 * Prisma 7 moved the datasource URL out of `schema.prisma` and stopped loading
 * `.env` automatically, so this file does both jobs:
 *   1. loads `.env.local` / `.env` into `process.env`
 *   2. hands the CLI the `DATABASE_URL` for `migrate`, `db push` and `studio`
 *
 * The application runtime reads the very same variable through the
 * `@prisma/adapter-pg` driver adapter in `src/lib/db/prisma.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

/** Tiny .env parser — no extra dependency, same precedence as Next.js. */
function loadEnvFile(file: string) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return;

  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;

    let value = trimmed.slice(eq + 1).trim();
    if (value.length > 1 && /^("|')/.test(value) && value.endsWith(value[0])) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, "\n");
    }
    process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Fallback keeps `prisma generate` (which never touches the database)
    // working on a machine where .env has not been created yet.
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/aurena_nails",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
