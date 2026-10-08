/**
 * POST /api/auth/logout — clears the session cookie and returns to the site.
 *
 * Kept as a route (not a server action) so plain <form method="post"> markup in
 * the header keeps working even before JavaScript loads.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const target = new URL("/login?loggedOut=1", request.nextUrl.origin);
  const response = NextResponse.redirect(target, { status: 303 });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const target = new URL("/login?loggedOut=1", request.nextUrl.origin);
  const response = NextResponse.redirect(target, { status: 303 });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
