"use strict";
/**
 * Minimal, dependency-free `.env` loader.
 *
 * Why this exists:
 *   * Prisma 7's CLI no longer auto-loads `.env` (Prisma 6 did).
 *   * `node prisma/seed.js` runs outside Next.js, so Next's automatic
 *     `.env` handling does not apply either.
 *
 * This keeps `npx prisma db push` and `node prisma/seed.js` working from the
 * project root on Windows, macOS and Linux without adding a dependency.
 *
 * Real environment variables always win — nothing already set is overwritten,
 * which is what production hosts (Netlify, Neon) require.
 *
 * All paths are resolved relative to this file, never hardcoded.
 */
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

// Loaded in priority order; earlier files win over later ones.
const CANDIDATE_FILES = [".env.local", ".env"];

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const eq = trimmed.indexOf("=");
  if (eq === -1) return null;

  let key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();

  // Strip an optional `export ` prefix.
  if (key.startsWith("export ")) key = key.slice(7).trim();
  if (!key) return null;

  // Strip surrounding quotes and unescape basic sequences inside double quotes.
  const isDouble = value.length >= 2 && value.startsWith('"') && value.endsWith('"');
  const isSingle = value.length >= 2 && value.startsWith("'") && value.endsWith("'");
  if (isDouble) {
    value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  } else if (isSingle) {
    value = value.slice(1, -1);
  } else {
    // Unquoted: drop trailing comments.
    const hash = value.indexOf(" #");
    if (hash !== -1) value = value.slice(0, hash).trim();
  }

  return [key, value];
}

/**
 * Load `.env` files into process.env without clobbering existing values.
 * @returns {string[]} absolute paths of the files that were found and parsed
 */
function loadEnv() {
  const loaded = [];

  for (const file of CANDIDATE_FILES) {
    const full = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(full)) continue;

    let contents;
    try {
      contents = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }

    loaded.push(full);
    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }

  return loaded;
}

module.exports = { loadEnv, PROJECT_ROOT };
