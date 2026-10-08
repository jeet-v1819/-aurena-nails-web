"use client";

/**
 * Customer registration. Indian mobile format is enforced (10 digits starting
 * 6-9, with an optional +91 / 0 prefix) and the server rejects duplicates for
 * both email and mobile number.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { registerAction } from "@/server/actions/auth";
import { registerSchema } from "@/validators/customer";
import { PasswordHints, PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import type { z } from "zod";

type RegisterValues = z.input<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const password = watch("password") ?? "";

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await registerAction(values);

    if (!result.ok) {
      notifyResult(result);
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.length) setError(field as keyof RegisterValues, { type: "server", message: messages[0] });
      }
      return;
    }

    notifyResult(result);
    router.replace(result.data?.redirectTo ?? "/profile");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="label">
            First name <span className="text-rosegold">*</span>
          </label>
          <input id="firstName" className="input mt-2" autoComplete="given-name" {...register("firstName")} />
          {errors.firstName ? <p className="field-error">{errors.firstName.message}</p> : null}
        </div>
        <div>
          <label htmlFor="lastName" className="label">
            Last name <span className="text-rosegold">*</span>
          </label>
          <input id="lastName" className="input mt-2" autoComplete="family-name" {...register("lastName")} />
          {errors.lastName ? <p className="field-error">{errors.lastName.message}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="label">
          Email address <span className="text-rosegold">*</span>
        </label>
        <input id="email" type="email" className="input mt-2" autoComplete="email" {...register("email")} />
        {errors.email ? <p className="field-error">{errors.email.message}</p> : null}
      </div>

      <div>
        <label htmlFor="mobile" className="label">
          Mobile number <span className="text-rosegold">*</span>
        </label>
        <input
          id="mobile"
          className="input mt-2"
          inputMode="tel"
          placeholder="+91 98765 43210"
          autoComplete="tel"
          {...register("mobile")}
        />
        <p className="mt-1.5 text-xs text-muted">Indian mobile number — used for appointment updates only.</p>
        {errors.mobile ? <p className="field-error">{errors.mobile.message}</p> : null}
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password <span className="text-rosegold">*</span>
        </label>
        <div className="mt-2">
          <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        </div>
        <PasswordHints value={password} />
        {errors.password ? <p className="field-error">{errors.password.message}</p> : null}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">
          Confirm password <span className="text-rosegold">*</span>
        </label>
        <div className="mt-2">
          <PasswordInput id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} />
        </div>
        {errors.confirmPassword ? <p className="field-error">{errors.confirmPassword.message}</p> : null}
      </div>

      <label className="flex items-start gap-2.5 text-sm text-charcoal-soft">
        <input type="checkbox" className="checkbox mt-0.5" {...register("acceptTerms")} />
        <span>
          I agree to be contacted about my appointments and understand that{" "}
          <Link href="/about" className="text-rosegold-dark hover:underline">
            the studio
          </Link>{" "}
          never shares my details.
        </span>
      </label>
      {errors.acceptTerms ? <p className="field-error">Please accept before continuing.</p> : null}

      <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
        {isSubmitting ? "Creating your account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-rosegold-dark hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
