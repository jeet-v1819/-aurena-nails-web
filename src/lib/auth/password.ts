/**
 * Password hashing and strength rules.
 *
 * bcrypt with cost 12 — deliberately slow, so brute forcing a leaked hash is
 * impractical. Plain text passwords are never logged, stored or emailed.
 */
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  suggestions: string[];
};

/** Lightweight, dependency-free strength meter used by the register/profile UI. */
export function passwordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else suggestions.push("Use at least 8 characters");

  if (password.length >= 12) score += 1;
  else if (password.length >= 8) suggestions.push("12+ characters is even safer");

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else suggestions.push("Mix upper and lower case letters");

  if (/\d/.test(password)) score += 1;
  else suggestions.push("Add at least one number");

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else suggestions.push("Add a symbol, e.g. ! or #");

  const capped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels: PasswordStrength["label"][] = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];

  return { score: capped, label: labels[capped], suggestions };
}

/** Secure random token for password reset links. */
export function generateResetToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
  };
}

/** Only the hash is stored, so a database leak cannot be replayed. */
export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
