"use client";

/**
 * Requests a password-reset link. The response is intentionally generic so the
 * form cannot be used to discover which email addresses have accounts.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { forgotPasswordAction } from "@/server/actions/auth";
import { forgotPasswordSchema } from "@/validators/customer";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import type { z } from "zod";

type ForgotValues = z.input<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await forgotPasswordAction(values);
    notifyResult(result);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setSent(true);
  });

  if (sent) {
    return (
      <Alert tone="success" title="Check your inbox">
        <p>
          If that email address belongs to an account, a password-reset link is on its way. The link expires in 30
          minutes and can only be used once.
        </p>
        <p className="mt-3 text-muted">
          Nothing arrived? Check your spam folder, or contact the studio and we will help you back in.
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <div>
        <label htmlFor="forgot-email" className="label">
          Email address
        </label>
        <input
          id="forgot-email"
          type="email"
          className="input mt-2"
          autoComplete="email"
          placeholder="you@example.com"
          {...register("email")}
        />
        {errors.email ? <p className="field-error">{errors.email.message}</p> : null}
      </div>

      <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
        {isSubmitting ? "Sending the link…" : "Send reset link"}
      </button>

      <p className="text-xs text-muted">
        For your security we do not reveal whether an email address is registered. Reset links expire after 30 minutes
        and stop working once used.
      </p>
    </form>
  );
}
