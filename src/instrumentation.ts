/**
 * Next.js instrumentation — runs once when the server process starts.
 *
 * Validates the required server-side environment (DATABASE_URL + AUTH_SECRET)
 * before any request is served, so a broken configuration fails immediately
 * with one clear, value-free error on the server instead of surfacing as a
 * confusing message (or a broken login) later on.
 */
import { validateServerEnv } from "@/lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  validateServerEnv();
  console.log("[env] Server environment validated (DATABASE_URL, AUTH_SECRET).");
}
