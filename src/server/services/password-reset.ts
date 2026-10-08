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

  // Invalidate previous tokens so only the newest link works.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, tokenHash } = generateResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/reset-password?token=${token}`;
  const message = passwordResetEmail(user.firstName, link, TOKEN_TTL_MINUTES);
  const delivery = await sendEmail({ to: user.email, ...message });

  if (!delivery.delivered) {
    // Development convenience: the link is printed by the mailer.
    console.info(`[password-reset] reset link for ${user.email}: ${link}`);
  }

  await createNotification({
    userId: user.id,
    type: "ACCOUNT",
    title: "Password reset requested",
    message: "A password reset link was requested for your account. It expires in 30 minutes.",
  });

  return genericResponse;
}

/** Returns the user a valid, unused, unexpired token belongs to. */
export async function verifyResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { id: true, email: true, firstName: true, isActive: true, deletedAt: true } } },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) return null;
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

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Any other outstanding link is invalidated as well.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, NOT: { id: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  await createNotification({
    userId: record.userId,
    type: "ACCOUNT",
    title: "Password changed",
    message: "Your password was reset successfully. You can now sign in with your new password.",
  });

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
