import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, MailCheck } from "lucide-react";
import { verifyResetToken } from "@/server/services/password-reset";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Choose a new password for your Aurena Nails account.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ token?: string | string[] }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = (Array.isArray(params.token) ? params.token[0] : params.token)?.trim() ?? "";

  const record = token ? await verifyResetToken(token) : null;

  if (!record) {
    return (
      <div>
        <p className="eyebrow">Account help</p>
        <h1 className="mt-3 text-3xl">This reset link is no longer valid</h1>

        <div className="mt-6">
          <Alert tone="warning" title="Link expired or already used">
            <span className="inline-flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Reset links expire after 30 minutes and can only be used once. Request a fresh link and we will email it
              straight away.
            </span>
          </Alert>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/forgot-password" className="btn-primary">
            Request a new link
          </Link>
          <Link href="/login" className="btn-outline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">Account help</p>
      <h1 className="mt-3 text-3xl">Choose a new password</h1>
      <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
        <MailCheck size={15} className="text-rosegold" />
        Resetting the password for <span className="text-charcoal-soft">{record.user.email}</span>
      </p>

      <div className="mt-8">
        <ResetPasswordForm token={token} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Changed your mind?{" "}
        <Link href="/login" className="text-rosegold-dark hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
