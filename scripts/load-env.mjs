#!/usr/bin/env node
/**
 * Minimal `.env` loader (no `dotenv` dependency).
 *
 * Prisma 7 no longer reads `.env` for you, and Next.js only auto-loads env files
 * for the Next.js process itself — so CLI helpers (Prisma config, migration
 * deployer, seed script) load them through this module instead.
 *
 * Precedence matches Next.js: real environment variables always win, then
 * `.env.local`, then `.env`.
 */
import fs from "node:fs";
import path from "node:path";

/** @param {string} file */
export function parseEnvFile(file) {
  /** @type {Record<string,string>} */
  const out = {};
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return out;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = trimmed.slice(eq + 1).trim();

    // Strip matching quotes and expand "\n" escapes inside double quotes.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    } else {
      // Drop trailing comments on unquoted values.
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }

    out[key] = value;
  }
  return out;
}

/**
 * Loads `.env.local` then `.env` into `process.env` without overwriting values
 * that are already set.
 * @param {{ cwd?: string }} [options]
 */
export function loadEnv({ cwd = process.cwd() } = {}) {
  const loaded = [];
  for (const file of [".env.local", ".env"]) {
    const full = path.join(cwd, file);
    if (!fs.existsSync(full)) continue;
    const values = parseEnvFile(full);
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    loaded.push(file);
  }
  return loaded;
}
