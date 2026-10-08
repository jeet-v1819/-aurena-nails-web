import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Request a password-reset link for your Aurena Nails account.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <p className="eyebrow">Account help</p>
      <h1 className="mt-3 text-3xl">Forgot your password?</h1>
      <p className="mt-3 text-sm text-muted">
        Enter the email address on your account and we will send you a secure link to choose a new password.
      </p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-rosegold-dark hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
