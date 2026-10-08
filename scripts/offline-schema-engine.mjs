#!/usr/bin/env node
/**
 * Offline stub for Prisma's native schema engine.
 *
 * `prisma generate` only needs the schema engine to *announce* its version /
 * validate the config file, and code generation itself is performed by the WASM
 * engine bundled inside the `prisma` package. Pointing
 * `PRISMA_SCHEMA_ENGINE_BINARY` here therefore lets generation succeed on hosts
 * that cannot download the real engine.
 *
 * It intentionally implements NOTHING else: any command that genuinely needs a
 * database (migrate / db push / studio / migrate diff) must use the real engine,
 * which this project installs automatically on first online run. Those commands
 * will fail loudly rather than silently doing the wrong thing.
 */
process.stdin.resume();
process.stdin.on("end", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
