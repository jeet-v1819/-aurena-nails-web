/**
 * Route guard (Next.js "proxy", the successor to middleware).
 *
 * This performs a cheap, edge-safe check of the session cookie so that people
 * are redirected to the right sign-in screen before a protected page renders.
 * It is deliberately *not* the security boundary: every server action and route
 * handler re-reads the user from PostgreSQL through `requireUser()` /
 * `requireAdmin()`, so a stale or tampered cookie can never reach admin data.
 */
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "aurena_session";

/** Pages only a signed-in customer (or admin) may open. */
const CUSTOMER_PREFIXES = ["/profile", "/appointments", "/wishlist", "/notifications"];

/** Pages only an administrator may open. */
const ADMIN_PREFIXES = ["/admin/dashboard", "/admin/customers", "/admin/services", "/admin/gallery", "/admin/videos", "/admin/appointments", "/admin/reviews", "/admin/messages", "/admin/categories", "/admin/content", "/admin/business-hours", "/admin/settings", "/admin/holidays"];

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/admin/login"];

type TokenPayload = { sub?: string; role?: "ADMIN" | "CUSTOMER" };

function secretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) return null;
  return new TextEncoder().encode(secret);
}

async function readSession(request: NextRequest): Promise<TokenPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const key = secretKey();
  if (!token || !key) return null;

  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return { sub: typeof payload.sub === "string" ? payload.sub : undefined, role: payload.role as TokenPayload["role"] };
  } catch {
    return null;
  }
}

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await readSession(request);

  // 1. Admin area — customers who wander in are sent to the customer home.
  if (matches(pathname, ADMIN_PREFIXES) && session?.role !== "ADMIN") {
    const target = session ? "/forbidden" : "/admin/login";
    const url = new URL(target, request.url);
    if (!session) url.searchParams.set("redirect", `${pathname}${search}`);
    // Distinguish "wrong role" from "not signed in" for the admin sign-in page.
    if (session) url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Customer area.
  if (matches(pathname, CUSTOMER_PREFIXES) && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", `${pathname}${search}`);
    url.searchParams.set("next", "required");
    return NextResponse.redirect(url);
  }

  // 3. Signed-in visitors do not need the sign-in screens (unless they just
  //    signed out or completed a reset, in which case the params matter).
  if (matches(pathname, AUTH_PAGES) && session && !request.nextUrl.searchParams.has("loggedOut") && !request.nextUrl.searchParams.has("reset")) {
    const target = session.role === "ADMIN" ? "/admin/dashboard" : "/profile";
    return NextResponse.redirect(new URL(target, request.url));
  }

  const response = NextResponse.next();
  // Keep responses fresh so a deactivated account cannot linger in the browser.
  if (matches(pathname, [...ADMIN_PREFIXES, ...CUSTOMER_PREFIXES])) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/profile/:path*",
    "/appointments/:path*",
    "/wishlist/:path*",
    "/notifications/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/admin/login",
  ],
};
