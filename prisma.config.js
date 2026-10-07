"use strict";
/**
 * Prisma 7 CLI configuration.
 *
 * In Prisma 7 the datasource `url` was REMOVED from schema.prisma; connection
 * URLs for the CLI (db push / migrate / studio) now live here, while the
 * runtime client receives a driver adapter in src/lib/prisma.js.
 *
 * Written in CommonJS JavaScript to keep the project TypeScript-free.
 */
const { defineConfig } = require("prisma/config");
const { loadEnv } = require("./prisma/load-env");

// Prisma 7 no longer reads .env for us.
loadEnv();

// Falling back to a local SQLite file keeps `prisma generate` working during a
// cold install (e.g. Netlify's postinstall) even before DATABASE_URL is wired
// up, instead of hard-failing the whole build.
const url = process.env.DATABASE_URL || "file:./dev.db";

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url,
  },
  migrations: {
    seed: "node prisma/seed.js",
  },
});
