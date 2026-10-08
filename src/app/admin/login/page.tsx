import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/primitives";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Admin Sign In",
  description: "Studio administration sign-in.",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-charcoal px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-rosegold-soft">
            <Lock size={24} />
          </span>
          <h1 className="mt-5 font-display text-3xl text-white">Studio Administration</h1>
          <p className="mt-2 text-sm text-white/60">
            {APP_NAME} · staff access only
          </p>
        </div>

        <div className="card mt-8 p-7">
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <LoginForm variant="admin" />
          </Suspense>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-white/50">
          <ShieldCheck size={13} className="text-rosegold-soft" />
          Sessions are signed, HTTP-only and expire automatically.
        </p>

        <p className="mt-4 text-center text-xs text-white/40">
          <Link href="/" className="inline-flex items-center gap-1.5 hover:text-white/70">
            <Sparkles size={12} /> Back to {APP_NAME}
          </Link>
        </p>
      </div>
    </div>
  );
}
