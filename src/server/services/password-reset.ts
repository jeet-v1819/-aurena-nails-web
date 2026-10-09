/**
 * Forgot-password flow.
 *
 *   1. customer submits their email address
 *   2. a single-use, hashed token is stored (30 minute expiry)
 *   3. a reset link is emailed (or logged when SMTP is not configured)
 *   4. the link lets the customer set a new password
 *   5. the token is marked used and can never be replayed
 *
 * The same response is returned whether or not the address exists, so the form
 * cannot be used to enumerate registered customers.
 */
import "server-only";
import { prisma } from "@/lib/db/prisma";
import { generateResetToken, hashPassword, hashResetToken } from "@/lib/auth/password";
import { normaliseEmail } from "@/lib/utils";
import { sendEmail } from "@/server/email/mailer";
import { passwordResetEmail } from "@/server/email/templates";
import { createNotification } from "./notifications";

const TOKEN_TTL_MINUTES = 30;

export async function requestPasswordReset(rawEmail: string) {
  const email = normaliseEmail(rawEmail);

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, firstName: true, email: true, isActive: true },
  });

  const genericResponse = {
    ok: true as const,
    message: "If an account exists for that email address, a reset link is on its way.",
  };

  if (!user || !user.isActive) return genericResponse;

  const { token, tokenHash } = generateResetToken();
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Concurrent requests for the same account serialize, so the second
    // request invalidates the first token even when both were submitted at once.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(1096118608, hashtext(${user.id}))`;
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/reset-password?token=${token}`;
  const message = passwordResetEmail(user.firstName, link, TOKEN_TTL_MINUTES);
  const delivery = await sendEmail({ to: user.email, ...message });

  if (!delivery.delivered && process.env.NODE_ENV !== "production") {
    // Development convenience only. Reset tokens must never be written to
    // production logs, where they could be replayed by anyone with log access.
    console.info(`[password-reset] reset link for ${user.email}: ${link}`);
  }

  try {
    await createNotification({
      userId: user.id,
      type: "ACCOUNT",
      title: "Password reset requested",
      message: "A password reset link was requested for your account. It expires in 30 minutes.",
    });
  } catch (error) {
    console.error("[password-reset] request notification could not be created:", error);
  }

  return genericResponse;
}

/** Returns the user a valid, unused, unexpired token belongs to. */
export async function verifyResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { id: true, email: true, firstName: true, isActive: true, deletedAt: true } } },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) return null;
  if (!record.user.isActive || record.user.deletedAt) return null;

  return record;
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
  const record = await verifyResetToken(token);

  if (!record) {
    return {
      ok: false,
      error: "This reset link has expired or has already been used. Please request a new one.",
      fieldErrors: { token: ["This reset link is no longer valid."] },
    };
  }

  const passwordHash = await hashPassword(newPassword);

  const now = new Date();
  const redeemed = await prisma.$transaction(async (tx) => {
    // Claim the token conditionally inside the same transaction as the password
    // update. Two concurrent reset requests can no longer both pass an earlier
    // read and overwrite each other's password.
    const claim = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claim.count !== 1) return false;

    const userUpdate = await tx.user.updateMany({
      where: { id: record.userId, isActive: true, deletedAt: null },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (userUpdate.count !== 1) return false;

    // Any other outstanding link is invalidated as well.
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, NOT: { id: record.id } },
      data: { usedAt: now },
    });

    return true;
  });

  if (!redeemed) {
    return {
      ok: false,
      error: "This reset link has expired or has already been used. Please request a new one.",
      fieldErrors: { token: ["This reset link is no longer valid."] },
    };
  }

  try {
    await createNotification({
      userId: record.userId,
      type: "ACCOUNT",
      title: "Password changed",
      message: "Your password was reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("[password-reset] completion notification could not be created:", error);
  }

  return { ok: true };
}

/** Housekeeping: removes expired tokens (called opportunistically). */
export async function purgeExpiredResetTokens() {
  try {
    await prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
    });
  } catch (error) {
    console.error("[password-reset] purge failed", error);
  }
}
