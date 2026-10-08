"use client";

/**
 * Route-level error boundary (500). Never shows a stack trace — just a calm
 * apology, a retry, and the studio's contact details.
 */
import { useEffect } from "react";
import Link from "next/link";
import { Home, Phone, RefreshCw, TriangleAlert } from "lucide-react";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The real detail goes to the server logs, never to the visitor.
    console.error("[route error]", error);
  }, [error]);

  return (
    <section className="section">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush text-rosegold">
            <TriangleAlert size={24} />
          </span>

          <p className="eyebrow mt-5">Error 500</p>
          <h1 className="mt-3 text-4xl">Something went wrong on our side</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
            This is not your fault. The problem has been logged and we are looking into it. You can try again — or call
            the studio and we will book your appointment for you.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn-primary" onClick={reset}>
              <RefreshCw size={16} /> Try again
            </button>
            <Link href="/" className="btn-outline">
              <Home size={16} /> Back to home
            </Link>
            <Link href="/contact" className="btn-outline">
              <Phone size={16} /> Contact the studio
            </Link>
          </div>

          {error.digest ? (
            <p className="mt-6 text-xs text-muted">
              Reference for support: <span className="font-mono text-charcoal-soft">{error.digest}</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
