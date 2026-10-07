/**
 * Server-side authentication / authorization helpers for API routes.
 *
 * Authorization is enforced HERE, in the API layer — not by hiding UI elements.
 * Every admin and seller endpoint calls requireRole()/requireAdmin()/
 * requireSeller() before touching the database, so the rules hold even if the
 * client is bypassed entirely (curl, Postman, a tampered browser).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/constants";
import { ApiError } from "@/lib/apiError";

/**
 * Read the authenticated user from the session cookie.
 * @returns {Promise<{id:string,email:string,name:string,role:string,status:boolean}|null>}
 */
export async function getSessionUser(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const user = session?.user;
    if (!user?.id) return null;
    // A user disabled or deleted mid-session must not keep access.
    if (user.status === false) return null;
    return user;
  } catch (error) {
    // getServerSession throws when NEXTAUTH_SECRET is missing/mismatched.
    // eslint-disable-next-line no-console
    console.error("[auth] session lookup failed:", error?.message || error);
    return null;
  }
}

/** Throw a 401 unless a user is signed in. */
export async function requireAuth(req, res) {
  const user = await getSessionUser(req, res);
  if (!user) throw ApiError.unauthorized("You must be signed in to do that.");
  return user;
}

/** Throw 401/403 unless the signed-in user has one of `roles`. */
export async function requireRole(req, res, roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await requireAuth(req, res);
  if (!allowed.includes(user.role)) {
    throw ApiError.forbidden(`This action requires one of the following roles: ${allowed.join(", ")}.`);
  }
  return user;
}

export const requireAdmin = (req, res) => requireRole(req, res, [ROLES.ADMIN]);

export const requireSeller = (req, res) => requireRole(req, res, [ROLES.SELLER, ROLES.ADMIN]);

/** Admins may act on anything; sellers only on records they own. */
export function assertOwnership(user, ownerId) {
  if (user.role === ROLES.ADMIN) return true;
  if (String(user.id) !== String(ownerId)) {
    throw ApiError.forbidden("You can only manage your own records.");
  }
  return true;
}
