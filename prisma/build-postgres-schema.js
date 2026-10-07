#!/usr/bin/env node
/**
 * Derives the production PostgreSQL schema from prisma/schema.prisma.
 *
 * Prisma pins the datasource `provider` as a literal in the schema file, so a
 * single schema cannot serve both local SQLite and production PostgreSQL.
 * Rather than hand-maintaining two copies (which drift), we keep ONE source of
 * truth — prisma/schema.prisma — and generate the Postgres variant from it.
 *
 * Usage:
 *   node prisma/build-postgres-schema.js      (or: npm run schema:pg)
 *   npx prisma db push --schema prisma/postgres/schema.prisma
 *
 * Output: prisma/postgres/schema.prisma  (git-ignored, always regenerated)
 *
 * The connection URL is NOT in the schema (Prisma 7 removed it) — it comes from
 * DATABASE_URL via prisma.config.js. Point DATABASE_URL at your PostgreSQL /
 * Neon connection string before running the db push above.
 *
 * No hardcoded absolute paths: everything is resolved relative to this file.
 */
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const SOURCE = path.join(HERE, "schema.prisma");
const OUT_DIR = path.join(HERE, "postgres");
const OUT_FILE = path.join(OUT_DIR, "schema.prisma");

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[schema:pg] source schema not found at ${SOURCE}`);
    process.exit(1);
  }

  let schema = fs.readFileSync(SOURCE, "utf8");

  // 1. Swap the datasource provider to PostgreSQL.
  const datasourceRe = /datasource\s+db\s*\{[^}]*\}/;
  if (!datasourceRe.test(schema)) {
    console.error("[schema:pg] could not locate a `datasource db { ... }` block");
    process.exit(1);
  }
  schema = schema.replace(
    datasourceRe,
    ["datasource db {", '  provider = "postgresql"', "}"].join("\n")
  );

  // 2. Rewrite the leading comment so the generated file explains itself.
  schema = schema.replace(
    /^\/\/[^\n]*\n/,
    "// GENERATED FILE — DO NOT EDIT BY HAND.\n" +
      "// Produced from prisma/schema.prisma by prisma/build-postgres-schema.js.\n" +
      "// Edit prisma/schema.prisma, then re-run `npm run schema:pg`.\n"
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, schema, "utf8");

  const relative = path.relative(process.cwd(), OUT_FILE) || OUT_FILE;
  console.log(`[schema:pg] wrote PostgreSQL schema -> ${relative}`);
  console.log("[schema:pg] apply it with:");
  console.log("  npx prisma db push --schema prisma/postgres/schema.prisma");
}

main();
