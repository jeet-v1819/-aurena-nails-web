/**
 * Customer & admin accounts: registration, sign-in, profile, and the admin
 * customer-management operations.
 */
import "server-only";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normaliseEmail, normaliseMobile } from "@/lib/utils";
import { createNotification } from "./notifications";
import { recordAudit } from "./audit";
import { sendEmail } from "@/server/email/mailer";
import { deactivatedAccountEmail, welcomeEmail } from "@/server/email/templates";
import type { RegisterInput } from "@/validators/customer";

export type SessionPayload = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  role: "ADMIN" | "CUSTOMER";
  isActive: boolean;
  avatarUrl: string | null;
};

const sessionSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  mobile: true,
  role: true,
  isActive: true,
  avatarUrl: true,
  avatarPublicId: true,
} as const;

/** Looks a user up by email OR mobile number (both are unique). */
export async function findUserByIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const select = { ...sessionSelect, passwordHash: true, deletedAt: true, role: true };

  // Email: trim + lowercase, exactly as stored at registration.
  if (trimmed.includes("@")) {
    return prisma.user.findFirst({
      where: { email: normaliseEmail(trimmed), deletedAt: null },
      select,
    });
  }

  // Mobile: normalise to the stored E.164 format (+91XXXXXXXXXX) so spaces,
  // a leading 0/91 or the +91 prefix cannot break the lookup. Falls back to
  // the whitespace-stripped input for anything that does not parse.
  const mobile = normaliseMobile(trimmed) ?? trimmed.replace(/[\s()-]/g, "");
  return prisma.user.findFirst({
    where: { mobile, deletedAt: null },
    select,
  });
}

export async function emailTaken(email: string, excludeUserId?: string) {
  const found = await prisma.user.findFirst({
    where: { email: normaliseEmail(email), ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}

export async function mobileTaken(mobile: string, excludeUserId?: string) {
  const found = await prisma.user.findFirst({
    where: { mobile, ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}

export type RegisterResult =
  | { ok: true; user: SessionPayload }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Creates a customer account. Mobile number is mandatory and unique. */
export async function registerCustomer(input: RegisterInput): Promise<RegisterResult> {
  const email = normaliseEmail(input.email);
  const fieldErrors: Record<string, string[]> = {};

  if (await emailTaken(email)) fieldErrors.email = ["This email address is already registered."];
  if (await mobileTaken(input.mobile)) fieldErrors.mobile = ["This mobile number is already registered."];

  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: Object.values(fieldErrors)[0][0], fieldErrors };
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      mobile: input.mobile,
      passwordHash,
      role: "CUSTOMER",
      isActive: true,
      avatarUrl: input.avatarUrl ? input.avatarUrl : null,
      avatarPublicId: input.avatarPublicId ? input.avatarPublicId : null,
      // Every customer gets a wishlist immediately.
      wishlist: { create: {} },
    },
    select: sessionSelect,
  });

  await createNotification({
    userId: user.id,
    type: "ACCOUNT",
    title: "Welcome to Aurena Nails",
    message: "Your account is ready. Book your first appointment and start saving designs you love.",
    link: "/booking",
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const welcome = welcomeEmail(user.firstName, appUrl);
  await sendEmail({ to: user.email, ...welcome });

  return { ok: true, user };
}

export type AuthResult =
  | { ok: true; user: SessionPayload }
  | { ok: false; error: string; code: "INVALID_CREDENTIALS" | "INACTIVE_ACCOUNT" | "ADMIN_ONLY" };

/** Verifies credentials. Deactivated accounts cannot sign in. */
export async function authenticate(
  identifier: string,
  password: string,
  options: { requireAdmin?: boolean } = {}
): Promise<AuthResult> {
  const dev = process.env.NODE_ENV === "development";
  if (dev) console.log("[AUTH] Login attempt");

  const invalid: AuthResult = {
    ok: false,
    error: "Invalid email/mobile or password.",
    code: "INVALID_CREDENTIALS",
  };

  const user = await findUserByIdentifier(identifier);
  if (dev) console.log("[AUTH] User lookup completed");
  if (!user || user.deletedAt) return invalid;

  const valid = await verifyPassword(password, user.passwordHash);
  if (dev) console.log("[AUTH] Password verification completed");
  if (!valid) return invalid;

  if (!user.isActive) {
    return {
      ok: false,
      error: "Your account is currently inactive. Please contact Aurena Nails.",
      code: "INACTIVE_ACCOUNT",
    };
  }

  if (options.requireAdmin && user.role !== "ADMIN") {
    return {
      ok: false,
      error: "This account does not have studio administrator access.",
      code: "ADMIN_ONLY",
    };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    ok: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
    },
  };
}

export async function getProfile(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      ...sessionSelect,
      createdAt: true,
      lastLoginAt: true,
      deactivatedAt: true,
      _count: { select: { appointments: true, reviews: true, notifications: true } },
    },
  });
}

export async function updateProfile(
  userId: string,
  input: { firstName: string; lastName: string; mobile: string; avatarUrl?: string; avatarPublicId?: string }
): Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  if (await mobileTaken(input.mobile, userId)) {
    return {
      ok: false,
      error: "That mobile number is already registered to another account.",
      fieldErrors: { mobile: ["That mobile number is already registered to another account."] },
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      mobile: input.mobile,
      ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.avatarPublicId ? { avatarPublicId: input.avatarPublicId } : {}),
    },
  });

  return { ok: true };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) return { ok: false, error: "Account not found." };

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return {
      ok: false,
      error: "Your current password is incorrect.",
      fieldErrors: { currentPassword: ["Your current password is incorrect."] },
    };
  }

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await createNotification({
    userId,
    type: "ACCOUNT",
    title: "Password updated",
    message: "Your password was changed. If this was not you, contact the studio immediately.",
    link: "/profile",
  });

  return { ok: true };
}

/* ------------------------------------------------------------- admin area */

export type CustomerFilters = {
  search?: string;
  status?: "active" | "inactive" | "all";
  page?: number;
  pageSize?: number;
};

/** Paginated customer list for /admin/customers with search + status filter. */
export async function listCustomers(filters: CustomerFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 15;
  const search = filters.search?.trim();

  const where = {
    role: "CUSTOMER" as const,
    deletedAt: null,
    ...(filters.status === "active" ? { isActive: true } : {}),
    ...(filters.status === "inactive" ? { isActive: false } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { mobile: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        mobile: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
        deactivatedAt: true,
        _count: { select: { appointments: true, reviews: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getCustomerById(customerId: string) {
  return prisma.user.findFirst({
    where: { id: customerId, role: "CUSTOMER" },
    select: {
      ...sessionSelect,
      createdAt: true,
      lastLoginAt: true,
      deactivatedAt: true,
      _count: { select: { appointments: true, reviews: true } },
    },
  });
}

/** Admin edit — never touches the password hash. */
export async function adminUpdateCustomer(
  adminId: string,
  customerId: string,
  input: { firstName: string; lastName: string; email: string; mobile: string; isActive: boolean }
): Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }> {
  const fieldErrors: Record<string, string[]> = {};
  const email = normaliseEmail(input.email);

  if (await emailTaken(email, customerId)) fieldErrors.email = ["Another account already uses this email address."];
  if (await mobileTaken(input.mobile, customerId)) fieldErrors.mobile = ["Another account already uses this mobile number."];

  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: Object.values(fieldErrors)[0][0], fieldErrors };
  }

  const before = await prisma.user.findUnique({
    where: { id: customerId },
    select: { isActive: true, firstName: true, email: true, mobile: true },
  });

  await prisma.user.update({
    where: { id: customerId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      mobile: input.mobile,
      isActive: input.isActive,
      deactivatedAt: input.isActive ? null : (before?.isActive === false ? undefined : new Date()),
    },
  });

  await recordAudit({
    actorId: adminId,
    action: "customer.update",
    entity: "User",
    entityId: customerId,
    changes: { before, after: input },
  });

  if (before && before.isActive !== input.isActive) {
    await handleActivationChange(adminId, customerId, input.isActive);
  }

  return { ok: true };
}

/** Activate / deactivate a customer. Deactivated customers cannot sign in. */
export async function setCustomerActive(
  adminId: string,
  customerId: string,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: "CUSTOMER" },
    select: { id: true, firstName: true, email: true, isActive: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };

  await prisma.user.update({
    where: { id: customerId },
    data: { isActive, deactivatedAt: isActive ? null : new Date() },
  });

  await recordAudit({
    actorId: adminId,
    action: isActive ? "customer.activate" : "customer.deactivate",
    entity: "User",
    entityId: customerId,
    changes: { isActive },
  });

  await handleActivationChange(adminId, customerId, isActive, customer);
  return { ok: true };
}

async function handleActivationChange(
  _adminId: string,
  customerId: string,
  isActive: boolean,
  customer?: { firstName: string; email: string }
) {
  const account = customer ?? (await prisma.user.findUnique({
    where: { id: customerId },
    select: { firstName: true, email: true },
  }));
  if (!account) return;

  if (isActive) {
    await createNotification({
      userId: customerId,
      type: "ACCOUNT",
      title: "Account reactivated",
      message: "Your Aurena Nails account is active again. We are glad to have you back.",
      link: "/profile",
    });
  } else {
    await createNotification({
      userId: customerId,
      type: "ACCOUNT",
      title: "Account deactivated",
      message: "Your account has been deactivated by the studio. Please contact Aurena Nails for details.",
    });
    const message = deactivatedAccountEmail(account.firstName);
    await sendEmail({ to: account.email, ...message });
  }
}

/**
 * Soft delete: the account is anonymised and hidden but appointment and review
 * history stays intact for the studio's records.
 */
export async function deleteCustomer(
  adminId: string,
  customerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: "CUSTOMER", deletedAt: null },
    select: { id: true, email: true, mobile: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };

  const suffix = Date.now().toString(36);

  await prisma.$transaction(async (tx) => {
    // Release the unique email/mobile so the person can register again, while
    // keeping the historical rows (appointments/reviews) readable.
    await tx.user.update({
      where: { id: customerId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        email: `deleted+${suffix}-${customer.email}`,
        mobile: `deleted-${suffix}-${customer.mobile}`,
      },
    });
    await tx.wishlistItem.deleteMany({ where: { wishlist: { userId: customerId } } });
    await tx.notification.deleteMany({ where: { userId: customerId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: customerId } });
  });

  await recordAudit({
    actorId: adminId,
    action: "customer.delete",
    entity: "User",
    entityId: customerId,
    changes: { email: customer.email },
  });

  return { ok: true };
}

export async function countCustomers() {
  const [total, active, inactive] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null, isActive: true } }),
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null, isActive: false } }),
  ]);
  return { total, active, inactive };
}
