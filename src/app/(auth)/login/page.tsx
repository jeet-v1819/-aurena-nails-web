import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Aurena Nails account with your email address or mobile number.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-3 text-3xl">Sign in to your account</h1>
      <p className="mt-3 text-sm text-muted">
        Use the email address or mobile number you registered with. Bookings, wishlist and reviews all live here.
      </p>

      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
