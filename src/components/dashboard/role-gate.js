"use client";

/**
 * Shared shell + guard for the admin and seller consoles.
 *
 * Every /admin/* and /seller/* page wraps itself in this. It renders the
 * loading state, redirects anonymous visitors to /login with a callbackUrl,
 * shows a clear 403 panel when a signed-in user has the wrong role, and
 * otherwise lays out <DashboardNav/> beside the page content.
 *
 * NOTE: this is a UX guard only. The actual authorization lives in the API
 * routes (requireAdmin / requireSeller reading the session server-side), so a
 * customer who hand-edits the URL still cannot read or change anything — they
 * simply see "Access denied" instead of an empty console.
 */
import Link from "next/link";
import { useSession } from "next-auth/react";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import { PageLoader } from "@/components/ui";
import { ROLES } from "@/lib/constants";

export default function RoleGate({ role, title, subtitle, heading, description, actions, children }) {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const allowed = status === "authenticated" && userRole === role;

  if (status === "loading") {
    return <PageLoader label="Checking your permissions..." />;
  }

  if (status === "unauthenticated") {
    const target = role === ROLES.ADMIN ? "/admin" : "/seller";
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600" aria-hidden="true">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="10.5" width="16" height="10" rx="2" />
              <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" strokeLinecap="round" />
            </svg>
          </span>
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Sign in required</h1>
          <p className="mt-1 text-sm text-gray-500">
            This area is restricted to {role.toLowerCase()} accounts. Please sign in to continue.
          </p>
          <Link href={`/login?callbackUrl=${encodeURIComponent(target)}`} className="btn-primary mt-5 w-full py-2.5">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-danger" aria-hidden="true">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5m0 3h.01" strokeLinecap="round" />
            </svg>
          </span>
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Access denied</h1>
          <p className="mt-1 text-sm text-gray-500">
            You are signed in as{" "}
            <span className="font-medium text-gray-700">{String(userRole || "unknown").toLowerCase()}</span>, but this
            console requires a <span className="font-medium text-gray-700">{role.toLowerCase()}</span> account. The API
            enforces this server-side as well, so retrying will not help.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {userRole === ROLES.SELLER && (
              <Link href="/seller" className="btn-primary">
                Go to seller console
              </Link>
            )}
            {userRole === ROLES.ADMIN && (
              <Link href="/admin" className="btn-primary">
                Go to admin console
              </Link>
            )}
            <Link href="/" className="btn-outline">
              Back to store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-900">{heading}</h1>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <DashboardNav role={role} title={title} subtitle={session?.user?.email} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
