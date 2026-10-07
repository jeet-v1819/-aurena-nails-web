/**
 * Route protection.
 *
 * NOTE ON THE FILENAME: Next.js 16 renamed the `middleware` file convention to
 * `proxy`. `middleware.js` still works but prints a deprecation warning, and
 * having BOTH is a hard build error — so this project uses the canonical
 * `src/proxy.js`.
 *
 * IMPORTANT: this is a convenience/UX guard only. It runs on the edge, decodes
 * the session JWT and redirects unauthenticated visitors to /login (or sends
 * sellers/customers away from /admin). It is NOT the security boundary.
 *
 * The real authorization lives in src/lib/auth.js and is enforced by every
 * /api/admin/* and /api/seller/* route, so bypassing this file (curl, a
 * pre-rendered page, a stale cookie) still cannot reach another role's data.
 */
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ADMIN_PREFIX = "/admin";
const SELLER_PREFIX = "/seller";

function loginUrl(req, reason) {
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  if (reason) url.searchParams.set("reason", reason);
  return url;
}

export default withAuth(
  function proxy(req) {
    const token = req.nextauth?.token;
    const { pathname } = req.nextUrl;
    const role = token?.role;
    const disabled = token?.status === false || token?.deleted === true;

    if (!token || disabled) {
      return NextResponse.redirect(loginUrl(req, disabled ? "disabled" : undefined));
    }

    if (pathname.startsWith(ADMIN_PREFIX) && role !== "ADMIN") {
      // Sellers land on their own dashboard; customers go home.
      const target = role === "SELLER" ? SELLER_PREFIX : "/";
      const url = new URL(target, req.nextUrl.origin);
      url.searchParams.set("denied", "admin");
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith(SELLER_PREFIX) && role !== "SELLER" && role !== "ADMIN") {
      const url = new URL(role === "ADMIN" ? ADMIN_PREFIX : "/", req.nextUrl.origin);
      url.searchParams.set("denied", "seller");
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Let the request through to the handler above, which does the real work.
      authorized: ({ token }) => Boolean(token),
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
    secret: process.env.NEXTAUTH_SECRET,
  }
);

/**
 * The matcher must be statically analysable: Next.js reads this export at build
 * time and rejects template literals and `.map()` spreads ("Unsupported template
 * literal with expressions at config.matcher[0]"). So the patterns are written
 * out literally. Guarded areas: the /admin and /seller consoles (role-checked
 * below) plus the customer-only pages /checkout, /orders, /wishlist, /profile
 * and /account. Add any new guarded area to this list.
 */
export const config = {
  // Only guard the areas that need it. Public shopping pages, /api and static
  // assets are deliberately excluded so the storefront stays fast and open.
  matcher: [
    "/admin/:path*",
    "/seller/:path*",
    "/checkout/:path*",
    "/orders/:path*",
    "/wishlist/:path*",
    "/profile/:path*",
    "/account/:path*",
  ],
};
