/**
 * The single authentication cookie shared by the whole application.
 *
 * Login, logout, `requireUser()` / `requireAdmin()`, `src/proxy.ts` and every
 * route handler must all agree on this one name — there must never be a second,
 * competing session cookie anywhere in the project.
 *
 * This module has no imports on purpose: `src/proxy.ts` runs on the edge and
 * cannot pull in `server-only` code from `session.ts`.
 */
export const SESSION_COOKIE = "aurena_session";
