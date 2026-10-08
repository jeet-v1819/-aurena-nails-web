#!/usr/bin/env node
/**
 * `npm run db:generate` / postinstall
 * ------------------------------------------------------------------
 * Runs `prisma generate` to produce the typed Prisma Client.
 *
 * Why this wrapper exists
 * -----------------------
 * The Prisma CLI downloads a **native schema engine** from `binaries.prisma.sh`
 * on first use. Sandboxes, air-gapped CI runners and some corporate networks
 * cannot reach that host, and when they cannot, `prisma generate` aborts with a
 * confusing `request to https://binaries.prisma.sh/... failed` error — even
 * though *code generation itself* is done by a WASM engine that already ships
 * inside the `prisma` npm package.
 *
 * So: we probe the mirror first.
 *   * reachable   -> run the normal command (full CLI functionality available)
 *   * unreachable -> re-run generation with PRISMA_SCHEMA_ENGINE_BINARY pointed
 *                    at a tiny no-op shim, which is enough for `generate`
 *                    because it never needs to talk to a database.
 *
 * Database commands (`migrate`, `db push`, `studio`) DO need the real engine, so
 * they are deliberately left alone: this project ships hand-verified SQL
 * migrations plus `scripts/db-deploy.mjs` to apply them without the CLI.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { loadEnv } from "./load-env.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SHIM = path.join(ROOT, "scripts", "offline-schema-engine.mjs");
const MIRROR = process.env.PRISMA_ENGINES_MIRROR || "https://binaries.prisma.sh";

loadEnv({ cwd: ROOT });

/** @returns {Promise<boolean>} true when the Prisma binary mirror is reachable */
async function mirrorReachable() {
  if (process.env.AURENA_FORCE_OFFLINE_PRISMA === "1") return false;
  try {
    await fetch(MIRROR, { method: "HEAD", signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

function run(command, args, extraEnv = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

const offline = !(await mirrorReachable());

if (offline) {
  console.log(
    "[prisma-generate] binaries.prisma.sh is unreachable — generating the client with the bundled WASM engine (offline mode)."
  );
}

const result = run(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "generate"],
  offline ? { PRISMA_SCHEMA_ENGINE_BINARY: SHIM, PRISMA_HIDE_UPDATE_MESSAGE: "1" } : {}
);

if (result.status !== 0) {
  console.error(
    "[prisma-generate] `prisma generate` failed. If the message above mentions\n" +
      "binaries.prisma.sh, your network blocks Prisma's binary mirror — run\n" +
      "  AURENA_FORCE_OFFLINE_PRISMA=1 npm run db:generate\n" +
      "to use the offline WASM engine."
  );
  process.exit(result.status ?? 1);
}
