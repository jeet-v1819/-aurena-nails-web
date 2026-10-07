"use client";

/**
 * Sign in.
 *
 * Did not exist. The README lists "User registration and login" under customer
 * features and the NextAuth credentials provider was implemented, but there was
 * no login page — and the old header read the role from
 * localStorage.getItem("userRole"), which nothing ever wrote.
 *
 * Uses next-auth's client signIn() with redirect:false so validation errors can
 * be shown inline, then routes by role (admins/sellers land on their console).
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { FieldError } from "@/components/ui";
import { DEMO_ACCOUNTS, ROLES, SHOW_DEMO_ACCOUNTS } from "@/lib/constants";

/** Where should this role land after signing in? */
function landingFor(role) {
  if (role === ROLES.ADMIN) return "/admin";
  if (role === ROLES.SELLER) return "/seller";
  return "/";
}

/** Only allow same-origin relative redirects — never an attacker-supplied URL. */
function safeCallback(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const callbackUrl = safeCallback(searchParams.get("callbackUrl"));
  const registered = searchParams.get("registered") === "1";

  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Already signed in? Go where they were heading instead of showing a form.
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace(callbackUrl || landingFor(session.user.role));
    }
  }, [callbackUrl, router, session?.user, status]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const errors = {};
    if (!form.email.trim()) errors.email = "Email is required.";
    if (!form.password) errors.password = "Password is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: form.email.trim(),
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        // NextAuth collapses every credentials failure to "CredentialsSignin";
        // the provider's own message arrives through the url query when it can.
        setFormError(
          result.error === "CredentialsSignin"
            ? "Incorrect email or password, or your account has been disabled."
            : "Could not sign you in. Please try again."
        );
        setSubmitting(false);
        return;
      }

      // Re-read the session so the header and role guards update immediately.
      const fresh = await fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      const role = fresh?.user?.role;
      router.replace(callbackUrl || landingFor(role));
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  async function fillDemo(account) {
    setForm({ email: account.email, password: account.password });
    setFieldErrors({});
    setFormError("");
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: account.email,
        password: account.password,
        redirect: false,
      });
      if (result?.error) {
        setFormError("That demo account is not available in this database. Run `npm run db:seed` first.");
        setSubmitting(false);
        return;
      }
      router.replace(callbackUrl || landingFor(account.role));
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

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to continue shopping.</p>

        {registered && (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
            Account created. Sign in below to get started.
          </p>
        )}

        {callbackUrl && (
          <p className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            You will be returned to <span className="font-medium">{callbackUrl}</span> after signing in.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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
                autoComplete="current-password"
                required
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
            <FieldError>{fieldErrors.password}</FieldError>
          </div>

          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
              {formError}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-600">
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      {/* Seeded demo logins — convenience only, never a bypass. */}
      {SHOW_DEMO_ACCOUNTS && (
      <div className="card mt-6 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Demo accounts</h2>
        <p className="mt-1 text-xs text-gray-500">
          Created by <code className="rounded bg-gray-100 px-1">npm run db:seed</code>. These sign in through the real
          credentials provider — they are not a bypass.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account)}
              disabled={submitting}
              className="rounded-md border border-gray-200 px-3 py-2 text-left text-xs transition-colors hover:border-primary hover:bg-green-50 disabled:opacity-50"
            >
              <span className="block font-semibold capitalize text-gray-900">{account.label}</span>
              <span className="mt-0.5 block truncate text-gray-500">{account.email}</span>
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-gray-500">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
