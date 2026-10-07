/**
 * /api/users/me
 *
 * GET   — the signed-in user's profile plus lightweight counts, and a
 *         role-specific summary (sellers get product/order/revenue counts,
 *         admins get platform counts) so dashboards need one request.
 * PUT   — update own profile: { name?, phone?, address? }
 * PATCH — change own password: { currentPassword, newPassword }
 *
 * Previously missing: there was no way for the /profile page to read or update
 * a user, and no self-service password change.
 *
 * Users may NOT change their own role or status here — those are admin-only
 * fields handled by /api/admin/users.
 */
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed, ApiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { round2 } from "@/utils/format";
import { serializeUser } from "@/utils/serialize";

async function profileSummary(user) {
  if (user.role === ROLES.ADMIN) {
    const [users, sellers, products, orders, revenue] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: ROLES.SELLER } }),
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { total: true } }),
    ]);
    return {
      scope: "admin",
      users,
      sellers,
      products,
      orders,
      revenue: round2(revenue._sum.total || 0),
    };
  }

  if (user.role === ROLES.SELLER) {
    const [products, activeProducts, orders, revenue, pending] = await Promise.all([
      prisma.product.count({ where: { sellerId: user.id } }),
      prisma.product.count({ where: { sellerId: user.id, status: "ACTIVE" } }),
      prisma.order.count({ where: { sellerId: user.id } }),
      prisma.order.aggregate({ where: { sellerId: user.id }, _sum: { total: true } }),
      prisma.order.count({ where: { sellerId: user.id, status: "PENDING" } }),
    ]);
    return {
      scope: "seller",
      products,
      activeProducts,
      orders,
      pendingOrders: pending,
      revenue: round2(revenue._sum.total || 0),
    };
  }

  const [orders, reviews, wishlistItems, cartItems] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.review.count({ where: { userId: user.id } }),
    prisma.wishlistItem.count({ where: { wishlist: { userId: user.id } } }),
    prisma.cartItem.count({ where: { cart: { userId: user.id } } }),
  ]);

  const spend = await prisma.order.aggregate({
    where: { userId: user.id, status: { not: "CANCELLED" } },
    _sum: { total: true },
  });

  return {
    scope: "customer",
    orders,
    reviews,
    wishlistItems,
    cartItems,
    totalSpent: round2(spend._sum.total || 0),
  };
}

export default async function handler(req, res) {
  try {
    const sessionUser = await requireAuth(req, res);

    // Always read fresh from the database rather than trusting the JWT.
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: { addresses: { orderBy: { isDefault: "desc" } } },
    });

    if (!user) throw ApiError.notFound("Account not found.");

    if (req.method === "GET") {
      const summary = await profileSummary(user);
      return res.status(200).json({ user: serializeUser(user), summary });
    }

    if (req.method === "PUT") {
      const data = {};
      const body = req.body || {};

      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (name.length < 2) throw ApiError.badRequest("Name must be at least 2 characters.");
        data.name = name;
      }
      if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
      if (body.address !== undefined) data.address = body.address ? String(body.address).trim() : null;

      // Email changes are allowed but must stay unique.
      if (body.email !== undefined) {
        const email = String(body.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest("Please enter a valid email address.");
        data.email = email;
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data,
        include: { addresses: { orderBy: { isDefault: "desc" } } },
      });

      return res.status(200).json({ user: serializeUser(updated), message: "Profile updated." });
    }

    if (req.method === "PATCH") {
      const { currentPassword, newPassword } = req.body || {};

      if (!user.password) {
        throw ApiError.badRequest("This account signs in with a social provider and has no password to change.");
      }
      if (!currentPassword || !newPassword) {
        throw ApiError.badRequest("Both currentPassword and newPassword are required.");
      }
      if (String(newPassword).length < 8) {
        throw ApiError.badRequest("New password must be at least 8 characters.");
      }

      const matches = await bcrypt.compare(String(currentPassword), user.password);
      if (!matches) throw new ApiError(403, "Your current password is incorrect.");

      const password = await bcrypt.hash(String(newPassword), 10);
      await prisma.user.update({ where: { id: user.id }, data: { password } });

      return res.status(200).json({ message: "Password updated." });
    }

    return methodNotAllowed(res, ["GET", "PUT", "PATCH"]);
  } catch (error) {
    return respondWithError(res, error, "Profile operation failed.");
  }
}
