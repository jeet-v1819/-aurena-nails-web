/**
 * POST /api/auth/register
 *
 * Public self-registration. Creates a CUSTOMER or SELLER account.
 * ADMIN accounts can never be self-created — they must be assigned by an
 * existing admin via /api/admin/users (role change).
 */
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { ApiError, respondWithError, methodNotAllowed } from "@/lib/apiError";
import { ROLES } from "@/lib/constants";
import { slugify } from "@/utils/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SELF_SERVABLE_ROLES = [ROLES.CUSTOMER, ROLES.SELLER];

function validate(body) {
  const errors = {};

  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const confirmPassword = String(body?.confirmPassword || password);
  let role = String(body?.role || ROLES.CUSTOMER).trim().toUpperCase();

  if (!name || name.length < 2) errors.name = "Please enter your full name (min 2 characters).";
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Please enter a valid email address.";

  if (!password) errors.password = "Password is required.";
  else if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = "Password must contain at least one letter and one number.";
  }

  if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";

  if (!SELF_SERVABLE_ROLES.includes(role)) {
    // Silently downgrade rather than leak which roles exist.
    role = ROLES.CUSTOMER;
  }

  return { errors, values: { name, email, password, role } };
}

/** Guarantee a unique slug, appending -2, -3, ... on collision. */
async function uniqueSlug(base, model, field = "slug") {
  const root = slugify(base) || "item";
  let candidate = root;
  for (let i = 2; i < 50; i += 1) {
    const existing = await model.findUnique({ where: { [field]: candidate } });
    if (!existing) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { errors, values } = validate(req.body);
    if (Object.keys(errors).length) {
      throw ApiError.unprocessable("Please correct the highlighted fields.", errors);
    }

    const existing = await prisma.user.findUnique({ where: { email: values.email } });
    if (existing) {
      throw new ApiError(409, "An account with that email already exists. Try signing in instead.");
    }

    const hashed = await bcrypt.hash(values.password, 10);

    const user = await prisma.user.create({
      data: {
        email: values.email,
        password: hashed,
        name: values.name,
        role: values.role,
        status: true,
        phone: req.body?.phone ? String(req.body.phone).trim() : null,
      },
    });

    // Sellers get an empty cart/wishlist lazily; nothing else to provision.
    // (Kept intentionally light so registration stays fast.)

    return res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return respondWithError(res, error, "Registration failed.");
  }
}

export { uniqueSlug };
