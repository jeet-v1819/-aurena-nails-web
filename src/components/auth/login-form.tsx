"use client";

/**
 * Sign-in form used by both the customer page and the admin portal.
 *
 * The identifier accepts an email address *or* a mobile number; the server
 * action decides which one it is and checks the password with bcrypt. Inactive
 * accounts are stopped with a specific, friendly message.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn, ShieldAlert } from "lucide-react";
import { adminLoginAction, loginAction } from "@/server/actions/auth";
import { loginSchema } from "@/validators/customer";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import type { z } from "zod";

type LoginValues = z.input<typeof loginSchema>;

/** Only same-origin, relative paths may be used as a post-login redirect. */
function safeRedirect(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function LoginForm({ variant = "customer" }: { variant?: "customer" | "admin" }) {
  const router = useRouter();
  const params = useSearchParams();
  const isAdmin = variant === "admin";

  const [formError, setFormError] = useState<string | null>(null);
  const [inactive, setInactive] = useState(false);

  const redirectTo = safeRedirect(params.get("redirect"));
  const loggedOut = params.get("loggedOut") === "1";
  const justReset = params.get("reset") === "1";
  const needsSignIn = params.get("next") === "required";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", remember: "on" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setInactive(false);

    const result = isAdmin ? await adminLoginAction(values) : await loginAction(values);

    if (!result.ok) {
      notifyResult(result);
      setFormError(result.code === "INACTIVE_ACCOUNT" ? null : result.error);
      setInactive(result.code === "INACTIVE_ACCOUNT");
      return;
    }

    notifyResult(result);

    const destination =
      redirectTo && (!isAdmin || redirectTo.startsWith("/admin")) ? redirectTo : result.data?.redirectTo ?? "/profile";

    router.replace(destination);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {inactive ? (
        <Alert tone="warning" title="Account inactive">
          <span className="inline-flex items-start gap-2">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            Your account is currently inactive. Please contact Aurena Nails.
          </span>
        </Alert>
      ) : null}

      {loggedOut ? <Alert tone="success">You have been signed out. See you soon!</Alert> : null}
      {justReset ? <Alert tone="success">Your password has been updated — please sign in with your new password.</Alert> : null}
      {needsSignIn ? <Alert tone="info">Please sign in to continue where you left off.</Alert> : null}
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <div>
        <label htmlFor="identifier" className="label">
          Email address or mobile number
        </label>
        <input
          id="identifier"
          className="input mt-2"
          autoComplete="username"
          placeholder={isAdmin ? "admin@aurenanails.in" : "you@example.com or 98765 43210"}
          {...register("identifier")}
        />
        {errors.identifier ? <p className="field-error">{errors.identifier.message}</p> : null}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="label">
            Password
          </label>
          {!isAdmin ? (
            <Link href="/forgot-password" className="text-xs text-rosegold-dark hover:underline">
              Forgot password?
            </Link>
          ) : null}
        </div>
        <div className="mt-2">
          <PasswordInput id="password" autoComplete="current-password" {...register("password")} />
        </div>
        {errors.password ? <p className="field-error">{errors.password.message}</p> : null}
      </div>

      <label className="flex items-center gap-2.5 text-sm text-charcoal-soft">
        <input type="checkbox" className="checkbox" {...register("remember")} />
        Keep me signed in on this device
      </label>

      <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        {isSubmitting ? "Signing in…" : isAdmin ? "Enter admin panel" : "Sign in"}
      </button>

      {!isAdmin ? (
        <p className="text-center text-sm text-muted">
          New to Aurena Nails?{" "}
          <Link href="/register" className="text-rosegold-dark hover:underline">
            Create an account
          </Link>
        </p>
      ) : (
        <p className="text-center text-xs text-muted">
          This portal is for studio staff only. Customer accounts sign in{" "}
          <Link href="/login" className="text-rosegold-dark hover:underline">
            here
          </Link>
          .
        </p>
      )}
    </form>
  );
}
