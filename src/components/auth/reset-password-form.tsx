"use client";

/**
 * Sets a new password from a single-use reset token. The token itself is
 * validated on the server before the form is rendered, and again by the action.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { resetPasswordAction } from "@/server/actions/auth";
import { resetPasswordSchema } from "@/validators/customer";
import { PasswordHints, PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import type { z } from "zod";

type ResetValues = z.input<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await resetPasswordAction({ ...values, token });

    if (!result.ok) {
      notifyResult(result);
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.length) setError(field as keyof ResetValues, { type: "server", message: messages[0] });
      }
      return;
    }

    notifyResult(result);
    router.replace(result.data?.redirectTo ?? "/login?reset=1");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      {/* The token travels with the form; the input itself stays hidden. */}
      <input type="hidden" {...register("token")} />

      <div>
        <label htmlFor="new-password" className="label">
          New password
        </label>
        <div className="mt-2">
          <PasswordInput id="new-password" autoComplete="new-password" {...register("password")} />
        </div>
        <PasswordHints value={password} />
        {errors.password ? <p className="field-error">{errors.password.message}</p> : null}
      </div>

      <div>
        <label htmlFor="confirm-new-password" className="label">
          Confirm new password
        </label>
        <div className="mt-2">
          <PasswordInput id="confirm-new-password" autoComplete="new-password" {...register("confirmPassword")} />
        </div>
        {errors.confirmPassword ? <p className="field-error">{errors.confirmPassword.message}</p> : null}
      </div>

      <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
        {isSubmitting ? "Updating your password…" : "Set new password"}
      </button>

      <p className="text-xs text-muted">
        For your security this link can only be used once. If it has expired, request a fresh one from the forgot
        password page.
      </p>
    </form>
  );
}
