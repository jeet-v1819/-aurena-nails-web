import Link from "next/link";
import type { Metadata } from "next";
import { Home, LogIn, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "403 · Access denied",
  robots: { index: false, follow: false },
};

/**
 * 403 — shown when a signed-in customer reaches an admin-only area, or any
 * other role-protected resource. The proxy and `requireAdmin()` both point here.
 */
export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; from?: string }>;
}) {
  const params = await searchParams;
  const area = params.area === "admin" || params.from?.startsWith("/admin") ? "admin" : null;

  return (
    <section className="section">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush text-rosegold">
            <ShieldAlert size={24} />
          </span>

          <p className="eyebrow mt-5">Error 403</p>
          <h1 className="mt-3 text-4xl">You do not have access to this area</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
            {area === "admin"
              ? "The studio dashboard is limited to administrator accounts. If you are part of the team and need access, ask the studio owner to upgrade your account."
              : "This page is protected. Please sign in with an account that has access."}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-primary">
              <Home size={16} /> Back to home
            </Link>
            <Link href="/profile" className="btn-outline">
              My account
            </Link>
            {area === "admin" ? (
              <Link href="/admin/login" className="btn-outline">
                <LogIn size={16} /> Admin sign in
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
