"use strict";
/**
 * Shared Prisma 7 driver-adapter factory.
 *
 * Prisma 7 removed the bundled Rust query engine: `PrismaClient` now REQUIRES a
 * driver adapter. This module picks the right adapter from DATABASE_URL so the
 * exact same application code runs against:
 *
 *   * SQLite  (local development)  -> @prisma/adapter-better-sqlite3 when it is
 *                                     installed, otherwise the pure-JS
 *                                     @prisma/adapter-libsql fallback
 *   * PostgreSQL / Neon (production)-> @prisma/adapter-pg
 *   * Turso / libSQL (remote)      -> @prisma/adapter-libsql
 *
 * Written in CommonJS with only relative/installed-package requires so it can be
 * shared by BOTH the Next.js server runtime (via src/lib/prisma.js) and plain
 * Node scripts (`node prisma/seed.js`), which cannot resolve the `@/*` alias.
 *
 * No hardcoded absolute filesystem paths anywhere — SQLite paths are resolved
 * relative to the project root, mirroring how the Prisma CLI resolves them
 * relative to prisma/.
 */
const fs = require("fs");
const path = require("path");

/**
 * Locate the project root WITHOUT relying on __dirname.
 *
 * __dirname is not stable here. When webpack bundles this file into
 * `.next/server/chunks/*.js`, __dirname points inside the build output, so a
 * relative `file:./dev.db` silently resolved to `.next/server/prisma/dev.db` —
 * an empty database that was created on first use. The CLI and
 * `node prisma/seed.js` kept working against the real `prisma/dev.db`, so the
 * failure only showed up at runtime as Prisma P2039 / "table does not exist".
 *
 * Instead the root is discovered by walking UP from process.cwd() (then, as a
 * fallback, from this file's own location for the unbundled case) until a
 * directory holding `prisma/schema.prisma` is found. That is correct under
 * `next dev`, `next start`, plain Node scripts, Netlify's build output and
 * Windows local development — and it is never a hardcoded absolute path.
 */
function looksLikeProjectRoot(dir) {
  try {
    return Boolean(dir) && fs.existsSync(path.join(dir, "prisma", "schema.prisma"));
  } catch {
    return false;
  }
}

function findProjectRoot() {
  const seeds = [];
  try {
    if (process.cwd()) seeds.push(process.cwd());
  } catch {
    /* cwd can be unreadable if it was deleted; the other seeds still apply */
  }
  try {
    seeds.push(path.resolve(__dirname, ".."));
    seeds.push(path.resolve(__dirname));
  } catch {
    /* no __dirname in some bundler runtimes */
  }

  for (const seed of seeds) {
    let dir = seed;
    for (let depth = 0; depth < 12; depth += 1) {
      if (looksLikeProjectRoot(dir)) return dir;
      const parent = path.dirname(dir);
      if (!parent || parent === dir) break;
      dir = parent;
    }
  }

  // Nothing matched — prefer cwd so the error the user sees points at the real
  // working directory rather than a guessed one.
  try {
    return process.cwd();
  } catch {
    return path.resolve(__dirname, "..");
  }
}

const PROJECT_ROOT = findProjectRoot();
const PRISMA_DIR = path.join(PROJECT_ROOT, "prisma");

const DEFAULT_SQLITE_URL = "file:./dev.db";

/**
 * Best-effort DATABASE_URL resolution.
 * Next.js injects .env values itself; plain Node scripts call loadEnv() first.
 */
function resolveDatabaseUrl(explicit) {
  const url = explicit || process.env.DATABASE_URL;
  if (url && String(url).trim()) return String(url).trim();
  return DEFAULT_SQLITE_URL;
}

/** @returns {"postgresql"|"sqlite"|"libsql"|"unknown"} */
function detectProvider(url) {
  const forced = (process.env.DATABASE_ADAPTER || "").toLowerCase();
  if (forced === "pg" || forced === "postgres" || forced === "postgresql") return "postgresql";
  if (forced === "better-sqlite3" || forced === "sqlite") return "sqlite";
  if (forced === "libsql" || forced === "turso") return "libsql";

  const lower = String(url).toLowerCase();
  if (lower.startsWith("postgres://") || lower.startsWith("postgresql://")) return "postgresql";
  if (lower.startsWith("libsql://") || lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("ws://") || lower.startsWith("wss://")) {
    return "libsql";
  }
  if (lower.startsWith("file:") || lower === ":memory:" || lower.startsWith("sqlite:")) return "sqlite";
  return "unknown";
}

/**
 * The Prisma CLI resolves a relative `file:./dev.db` against the directory that
 * holds schema.prisma (i.e. prisma/). The runtime adapter resolves against
 * process.cwd(). Normalising here guarantees `prisma db push`, `prisma/seed.js`
 * and the running server all open THE SAME database file, on every OS.
 */
function normalizeSqliteUrl(url) {
  if (url === ":memory:") return url;

  let raw = url.startsWith("sqlite:") ? url.slice("sqlite:".length) : url;
  if (!raw.startsWith("file:")) return url;

  let filePart = raw.slice("file:".length);
  const queryIndex = filePart.indexOf("?");
  const query = queryIndex === -1 ? "" : filePart.slice(queryIndex);
  if (queryIndex !== -1) filePart = filePart.slice(0, queryIndex);

  if (!filePart) return url;

  const absolute = path.isAbsolute(filePart)
    ? filePart
    : path.resolve(PRISMA_DIR, filePart.replace(/^\.?\//, ""));

  // Ensure the parent directory exists so a first run does not fail.
  try {
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
  } catch {
    /* non-fatal: the adapter will surface a clearer error */
  }

  return `file:${absolute}${query}`;
}

/**
 * Optional adapters are loaded with EXPLICIT, statically-analysable requires.
 *
 * A generic `require(name)` helper makes webpack emit
 *   "Critical dependency: the request of a dependency is an expression"
 * because it cannot know which module will be requested at build time. Writing
 * one try/catch per package keeps the same optional behaviour (better-sqlite3 is
 * an optionalDependency and legitimately absent on machines that cannot build
 * native addons) while letting webpack resolve — and, via `serverExternalPackages`
 * in next.config.js, externalise — each one.
 */
function swallowMissing(error) {
  if (error && (error.code === "MODULE_NOT_FOUND" || error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED")) {
    return null;
  }
  throw error;
}

function loadPgModule() {
  try {
    return require("@prisma/adapter-pg");
  } catch (error) {
    return swallowMissing(error);
  }
}

function loadLibsqlModule() {
  try {
    return require("@prisma/adapter-libsql");
  } catch (error) {
    return swallowMissing(error);
  }
}

function loadBetterSqlite3Module() {
  try {
    return require("@prisma/adapter-better-sqlite3");
  } catch (error) {
    return swallowMissing(error);
  }
}

function createPgAdapter(url) {
  const mod = loadPgModule();
  if (!mod || !mod.PrismaPg) {
    throw new Error(
      "DATABASE_URL points at PostgreSQL but @prisma/adapter-pg is not installed.\n" +
        "  Run: npm install @prisma/adapter-pg"
    );
  }
  return new mod.PrismaPg({ connectionString: url });
}

function createLibsqlAdapter(url) {
  const mod = loadLibsqlModule();
  if (!mod || !mod.PrismaLibSql) {
    throw new Error(
      "A libSQL/Turso adapter was requested but @prisma/adapter-libsql is not installed.\n" +
        "  Run: npm install @prisma/adapter-libsql"
    );
  }
  const config = { url };
  if (process.env.DATABASE_AUTH_TOKEN) config.authToken = process.env.DATABASE_AUTH_TOKEN;
  return new mod.PrismaLibSql(config);
}

function createBetterSqlite3Adapter(url) {
  const mod = loadBetterSqlite3Module();
  if (!mod || !mod.PrismaBetterSQLite3) return null;
  try {
    return new mod.PrismaBetterSQLite3({ url });
  } catch {
    // Native binding unavailable (e.g. no prebuilt binary for this platform).
    return null;
  }
}

/**
 * Build the driver adapter for a given connection URL.
 * @param {string} [explicitUrl]
 */
function createPrismaAdapter(explicitUrl) {
  const url = resolveDatabaseUrl(explicitUrl);
  const provider = detectProvider(url);

  switch (provider) {
    case "postgresql":
      return { adapter: createPgAdapter(url), provider: "postgresql", url };

    case "libsql":
      return { adapter: createLibsqlAdapter(url), provider: "sqlite", url };

    case "sqlite": {
      const sqliteUrl = normalizeSqliteUrl(url);
      if (sqliteUrl !== ":memory:") {
        const native = createBetterSqlite3Adapter(sqliteUrl);
        if (native) return { adapter: native, provider: "sqlite", url: sqliteUrl, driver: "better-sqlite3" };
      }
      // Pure-JS fallback — keeps local dev working where better-sqlite3's native
      // addon cannot be built (restricted CI, some Netlify images, WSL edge cases).
      return { adapter: createLibsqlAdapter(sqliteUrl), provider: "sqlite", url: sqliteUrl, driver: "libsql" };
    }

    default:
      throw new Error(
        `Unsupported DATABASE_URL scheme. Received: "${url}".\n` +
          "Expected a PostgreSQL URL (postgresql://...) or a SQLite URL (file:./dev.db)."
      );
  }
}

module.exports = {
  createPrismaAdapter,
  detectProvider,
  normalizeSqliteUrl,
  resolveDatabaseUrl,
  PROJECT_ROOT,
  PRISMA_DIR,
  DEFAULT_SQLITE_URL,
};
