"use server";

/**
 * Authentication server actions: register, sign in (customer & admin),
 * sign out, forgot password and password reset.
 */
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth/session";
import { safeInternalRedirectTarget } from "@/lib/navigation";
import { actionFailure, actionSuccess, toActionFailure, type ActionResult } from "@/lib/errors";
import { normalizeInput, validate } from "@/lib/validation";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/validators/customer";
import { authenticate, registerCustomer } from "@/server/services/users";
import { purgeExpiredResetTokens, requestPasswordReset, resetPassword, verifyResetToken } from "@/server/services/password-reset";

export async function registerAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const parsed = validate(registerSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await registerCustomer(parsed.data);
    if (!result.ok) return actionFailure(result.error, { fieldErrors: result.fieldErrors });

    await createSession(result.user.id, true, result.user.role, result.user.sessionVersion);

    // Keep the table tidy without blocking the response.
    void purgeExpiredResetTokens();

    return actionSuccess("Welcome to Aurena Nails! Your account is ready.", { redirectTo: "/profile" });
  } catch (error) {
    return toActionFailure(error, "We could not create your account. Please try again.");
  }
}

export async function loginAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult<{ redirectTo: string; role: "ADMIN" | "CUSTOMER" }>> {
  try {
    const parsed = validate(loginSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await authenticate(parsed.data.identifier, parsed.data.password);
    if (!result.ok) {
      return actionFailure(result.error, {
        code: result.code,
        fieldErrors: result.code === "INACTIVE_ACCOUNT" ? undefined : { password: ["Incorrect email/mobile or password."] },
      });
    }

    const remember = parsed.data.remember === "on" || parsed.data.remember === "true" || parsed.data.remember === true;
    await createSession(result.user.id, remember, result.user.role, result.user.sessionVersion);

    const redirectTo = result.user.role === "ADMIN" ? "/admin/dashboard" : "/profile";
    return actionSuccess(`Welcome back, ${result.user.firstName}!`, { redirectTo, role: result.user.role });
  } catch (error) {
    return toActionFailure(error, "We could not sign you in. Please try again.");
  }
}

export async function adminLoginAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const parsed = validate(loginSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await authenticate(parsed.data.identifier, parsed.data.password, { requireAdmin: true });
    if (!result.ok) {
      return actionFailure(result.error, {
        code: result.code,
        fieldErrors: result.code === "ADMIN_ONLY" ? undefined : { password: ["Incorrect credentials."] },
      });
    }

    await createSession(result.user.id, true, result.user.role, result.user.sessionVersion);
    return actionSuccess(`Welcome back, ${result.user.firstName}.`, { redirectTo: "/admin/dashboard" });
  } catch (error) {
    return toActionFailure(error, "We could not sign you in. Please try again.");
  }
}

export async function logoutAction(redirectTo = "/") {
  await destroySession();
  redirect(safeInternalRedirectTarget(redirectTo));
}

export async function logoutToLoginAction() {
  await destroySession();
  redirect("/login?loggedOut=1");
}

export async function forgotPasswordAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const parsed = validate(forgotPasswordSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await requestPasswordReset(parsed.data.email);
    void purgeExpiredResetTokens();
    return actionSuccess(result.message);
  } catch (error) {
    return toActionFailure(error, "We could not send the reset email. Please try again.");
  }
}

export async function resetPasswordAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const parsed = validate(resetPasswordSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await resetPassword(parsed.data.token, parsed.data.password);
    if (!result.ok) return actionFailure(result.error, { fieldErrors: result.fieldErrors });

    return actionSuccess("Your password has been updated. Please sign in.", { redirectTo: "/login?reset=1" });
  } catch (error) {
    return toActionFailure(error, "We could not reset your password. Please request a new link.");
  }
}

/** Used by the reset-password page to show a friendly message for dead links. */
export async function checkResetTokenAction(token: string) {
  const record = await verifyResetToken(token);
  return record
    ? { valid: true as const, email: record.user.email }
    : { valid: false as const, email: null };
}
