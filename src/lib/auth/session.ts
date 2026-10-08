/**
 * Session management.
 *
 * Aurena Nails uses a signed JWT stored in an **HTTP-only, SameSite=Lax cookie**
 * (never readable from JavaScript, so XSS cannot steal it). Passwords are hashed
 * with bcrypt.
 *
 * Security model
 * --------------
 * * `src/proxy.ts` performs a cheap cookie/JWT check for navigation (UX only).
 * * Every server action and route handler calls `requireUser()` / `requireAdmin()`,
 *   which re-reads the user from PostgreSQL. That means deactivating an account
 *   or deleting it takes effect immediately, even if a JWT is still valid.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const SESSION_COOKIE = "aurena_session";
const SESSION_DAYS = 30;
const SESSION_DAYS_SHORT = 1;

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  role: Role;
  isActive: boolean;
  avatarUrl: string | null;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signs a session token for a user id.
 *
 * The role travels inside the token so `src/proxy.ts` can route people to the
 * right screen without a database round-trip. It is only a hint — every
 * protected action and route handler re-reads the user from PostgreSQL through
 * `requireUser()` / `requireAdmin()`, so a stale role can never grant access.
 */
export async function signSessionToken(userId: string, remember: boolean, role?: Role) {
  const maxAge = (remember ? SESSION_DAYS : SESSION_DAYS_SHORT) * 24 * 60 * 60;
  return new SignJWT(role ? { sub: userId, role } : { sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey());
}

/** Writes the session cookie. `remember` = stay signed in for 30 days. */
export async function createSession(userId: string, remember = true, role?: Role) {
  const token = await signSessionToken(userId, remember, role);
  const maxAge = (remember ? SESSION_DAYS : SESSION_DAYS_SHORT) * 24 * 60 * 60;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Reads the signed cookie and loads the account. Returns null when anonymous. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    userId = payload.sub;
  } catch {
    return null; // expired or tampered token
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        mobile: true,
        role: true,
        isActive: true,
        avatarUrl: true,
      },
    });
    if (!user || !user.isActive) return null;

    return { ...user, fullName: `${user.firstName} ${user.lastName}`.trim() };
  } catch {
    // Database unreachable — treat as signed out rather than crashing the page.
    return null;
  }
}

/** Throws a redirect to /login when the visitor is not signed in. */
export async function requireUser(callbackUrl?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`);
  }
  return user;
}

/** Throws a redirect to /admin/login when the visitor is not an active admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login?reason=auth");
  if (user.role !== "ADMIN") redirect("/forbidden?area=admin");
  return user;
}

/** Server actions cannot redirect anonymous users the same way — they return false. */
export async function getAdminOrNull(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user && user.role === "ADMIN" ? user : null;
}

/** True when the signed-in customer has saved the given service or design. */
export async function getSessionUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
