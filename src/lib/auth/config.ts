/** Shared, dependency-free auth configuration used by Node and Next's edge proxy. */
export const SESSION_COOKIE = "aurena_session";

/**
 * HS256 requires at least 256 bits of secret material. The expected value is a
 * random 32-byte base64 secret, not an application URL or a credential copied
 * from another service.
 */
type AuthEnvironment = {
  DATABASE_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  CLOUDINARY_API_SECRET?: string;
};

export function isValidAuthSecret(
  secret: string | undefined,
  environment: AuthEnvironment = process.env as AuthEnvironment
): secret is string {
  if (!secret || secret.trim() !== secret || new TextEncoder().encode(secret).byteLength < 32) return false;
  if (/^(?:https?|postgres(?:ql)?):\/\//i.test(secret)) return false;

  const forbiddenValues = [
    environment.DATABASE_URL,
    environment.NEXT_PUBLIC_APP_URL,
    environment.CLOUDINARY_API_SECRET,
  ];
  if (forbiddenValues.some((value) => Boolean(value) && secret === value)) return false;

  const databaseUrl = environment.DATABASE_URL;
  if (databaseUrl) {
    try {
      const password = decodeURIComponent(new URL(databaseUrl).password);
      if (password && secret === password) return false;
    } catch {
      // Invalid database URLs are reported by the database configuration; they
      // do not make a candidate auth secret valid if it is URL-shaped above.
    }
  }

  return true;
}
