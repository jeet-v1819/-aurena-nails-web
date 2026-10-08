import Link from "next/link";
import type { Metadata } from "next";
import { Home, KeyRound, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "401 · Sign in required",
  robots: { index: false, follow: false },
};

/**
 * 401 — the "you must be signed in" screen. Reachable directly, and linked from
 * guards that prefer an explanation page over an instant redirect.
 */
export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const target = params.next && params.next.startsWith("/") ? params.next : "/";

  return (
    <section className="section">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush text-rosegold">
            <Lock size={24} />
          </span>

          <p className="eyebrow mt-5">Error 401</p>
          <h1 className="mt-3 text-4xl">Please sign in to continue</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
            Your appointments, wishlist and notifications live behind your account — sign in and we will take you
            straight back to what you were doing.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/login?redirect=${encodeURIComponent(target)}`} className="btn-primary">
              <KeyRound size={16} /> Sign in
            </Link>
            <Link href="/register" className="btn-outline">
              Create an account
            </Link>
            <Link href="/" className="btn-ghost">
              <Home size={16} /> Home
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted">
            Forgotten your password?{" "}
            <Link href="/forgot-password" className="text-rosegold-dark hover:underline">
              Reset it here
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
