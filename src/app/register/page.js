"use client";

/**
 * Register — did not exist before.
 *
 * POSTs to the existing /api/auth/register endpoint (which hashes with bcrypt
 * and refuses to self-create ADMIN accounts), then signs the new user straight
 * in with the credentials provider so there is no second round trip to /login.
 *
 * Field-level errors come back as `details` on the ApiClientError thrown by
 * @/lib/api, so validation messages land next to the right input.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { FieldError } from "@/components/ui";
import { ROLES } from "@/lib/constants";

const ROLE_CHOICES = [
  {
    value: ROLES.CUSTOMER,
    label: "I'm shopping",
    hint: "Browse, buy, review and track orders.",
  },
  {
    value: ROLES.SELLER,
    label: "I'm selling",
    hint: "List products, manage stock and fulfil orders.",
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const callbackUrl = searchParams.get("callbackUrl");
  const safeCallback =
    typeof callbackUrl === "string" && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : null;

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: ROLES.CUSTOMER,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(safeCallback || "/");
  }, [router, safeCallback, status]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setFormError("");
  }

  function validate() {
    const errors = {};
    if (form.name.trim().length < 2) errors.name = "Please enter your full name (min 2 characters).";
    if (!EMAIL_RE.test(form.email.trim())) errors.email = "Please enter a valid email address.";
    if (form.password.length < 8) errors.password = "Password must be at least 8 characters.";
    else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errors.password = "Password must contain at least one letter and one number.";
    }
    if (form.password !== form.confirmPassword) errors.confirmPassword = "Passwords do not match.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          confirmPassword: form.confirmPassword,
          role: form.role,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setFormError(payload?.error || "Could not create your account. Please try again.");
        if (payload?.details) setFieldErrors(payload.details);
        setSubmitting(false);
        return;
      }

      // Account exists — sign straight in rather than bouncing to /login.
      const signedIn = await signIn("credentials", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        redirect: false,
      });

      if (signedIn?.error) {
        router.replace(`/login?registered=1${safeCallback ? `&callbackUrl=${encodeURIComponent(safeCallback)}` : ""}`);
        return;
      }

      const target = safeCallback || (form.role === ROLES.SELLER ? "/seller" : "/");
      router.replace(target);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  if (status === "authenticated") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <p className="text-sm text-gray-600">You are already signed in. Redirecting...</p>
      </div>
    );
  }

  const passwordStrength = (() => {
    const value = form.password;
    if (!value) return null;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    const label = score <= 2 ? "Weak" : score === 3 ? "Fair" : score === 4 ? "Good" : "Strong";
    const colour = score <= 2 ? "bg-danger" : score === 3 ? "bg-amber-400" : "bg-primary";
    return { score, label, colour };
  })();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:px-6">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">
          Join as a shopper or as a seller — you can also be invited to admin later by an existing administrator.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <fieldset disabled={submitting}>
            <legend className="label">I am joining as</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ROLE_CHOICES.map((choice) => (
                <label
                  key={choice.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                    form.role === choice.value ? "border-primary bg-green-50" : "border-gray-200 hover:border-primary"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={choice.value}
                    checked={form.role === choice.value}
                    onChange={() => setField("role", choice.value)}
                    className="mt-0.5 h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{choice.label}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{choice.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="name" className="label">
              Full name
            </label>
            <input
              id="name"
              className="input"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              autoComplete="name"
              required
              disabled={submitting}
            />
            <FieldError>{fieldErrors.name}</FieldError>
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              autoComplete="email"
              required
              disabled={submitting}
            />
            <FieldError>{fieldErrors.email}</FieldError>
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Phone <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              className="input"
              value={form.phone}
              onChange={(event) => setField("phone", event.target.value)}
              autoComplete="tel"
              placeholder="+91 98765 43210"
              disabled={submitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="input pr-16"
                  value={form.password}
                  onChange={(event) => setField("password", event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-primary"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {passwordStrength && (
                <div className="mt-2">
                  <div className="flex gap-1" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((step) => (
                      <span
                        key={step}
                        className={`h-1 flex-1 rounded-full ${step <= passwordStrength.score ? passwordStrength.colour : "bg-gray-200"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{passwordStrength.label} — min 8 chars, with a letter and a number.</p>
                </div>
              )}
              <FieldError>{fieldErrors.password}</FieldError>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                className="input"
                value={form.confirmPassword}
                onChange={(event) => setField("confirmPassword", event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={submitting}
              />
              <FieldError>{fieldErrors.confirmPassword}</FieldError>
            </div>
          </div>

          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
              {formError}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
            {submitting ? "Creating your account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-gray-500">Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
