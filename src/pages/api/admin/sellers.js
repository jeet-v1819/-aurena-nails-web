/**
 * /api/admin/sellers  — ADMIN only.
 *
 * GET    ?search=&status=&page=&limit=   paginated seller list
 * GET    ?id=...                         one seller + performance stats
 * POST   body {name,email,password?}     create a seller account (admin onboarding)
 * PUT    body {id,status?}               enable / disable a seller
 * DELETE ?id=...                         delete a seller (force=true if they own data)
 *
 * SECURITY FIX: no authentication at all before — any visitor could list,
 * disable or delete sellers. All branches now require ADMIN.
 *
 * Fixes to the queries themselves:
 *   - `prisma.user.count({ where })` and the per-seller stat block are now
 *     scoped with `where: { role: "SELLER", ... }` so the count matches the
 *     filtered list rather than counting every user in the database.
 *   - `totalPages` used the raw `limit` string from the query ("10"), producing
 *     string concatenation instead of division. It now uses the parsed integer.
 *   - `const { id } = req.query || req.body` never fell through to the body.
 *   - Deleting a seller cascades to their products and orders, so it now
 *     requires an explicit force=true when they own data.
 *   - Disabling a seller also deactivates their products, so a disabled vendor
 *     cannot keep selling through the storefront.
 */
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed, ApiError } from "@/lib/apiError";
import { requireAdmin } from "@/lib/auth";
import { PRODUCT_STATUS, ROLES } from "@/lib/constants";
import { normalizePagination, round2 } from "@/utils/format";
import { toBoolean } from "@/utils/query";
import { serializeUser } from "@/utils/serialize";
import { searchOr } from "@/utils/query";

const SELLER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  phone: true,
  createdAt: true,
};

function buildWhere(query) {
  const where = { role: ROLES.SELLER };

  if (query.search) {
    const or = searchOr(query.search, ["name", "email", "phone"]);
    if (or) where.OR = or;
  }
  if (query.status !== undefined && query.status !== "") {
    where.status = toBoolean(query.status);
  }
  return where;
}

/** Revenue / catalogue / order statistics for one seller. */
async function sellerStats(sellerId) {
  const [totalProducts, activeProducts, outOfStock, totalOrders, pendingOrders, processingOrders, shippedOrders, completedOrders, cancelledOrders, sales] =
    await Promise.all([
      prisma.product.count({ where: { sellerId } }),
      prisma.product.count({ where: { sellerId, status: PRODUCT_STATUS.ACTIVE } }),
      prisma.product.count({ where: { sellerId, stock: { lte: 0 } } }),
      prisma.order.count({ where: { sellerId } }),
      prisma.order.count({ where: { sellerId, status: "PENDING" } }),
      prisma.order.count({ where: { sellerId, status: "PROCESSING" } }),
      prisma.order.count({ where: { sellerId, status: "SHIPPED" } }),
      prisma.order.count({ where: { sellerId, status: "DELIVERED" } }),
      prisma.order.count({ where: { sellerId, status: "CANCELLED" } }),
      prisma.order.aggregate({
        where: { sellerId, status: { notIn: ["CANCELLED", "REFUNDED"] } },
        _sum: { total: true, subtotal: true },
      }),
    ]);

  const units = await prisma.orderItem.aggregate({
    where: { order: { sellerId, status: { notIn: ["CANCELLED", "REFUNDED"] } } },
    _sum: { quantity: true },
  });

  return {
    totalProducts,
    activeProducts,
    outOfStock,
    totalOrders,
    pendingOrders,
    processingOrders,
    shippedOrders,
    completedOrders,
    cancelledOrders,
    totalSales: round2(sales._sum.total || 0),
    grossSubtotal: round2(sales._sum.subtotal || 0),
    unitsSold: units._sum.quantity || 0,
  };
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req, res);
    const query = req.query || {};

    if (req.method === "GET") {
      if (query.id) {
        const seller = await prisma.user.findFirst({
          where: { id: String(query.id), role: ROLES.SELLER },
          select: SELLER_SELECT,
        });
        if (!seller) throw ApiError.notFound("Seller not found.");

        return res.status(200).json({ seller, stats: await sellerStats(seller.id) });
      }

      const where = buildWhere(query);
      const { page, limit, skip } = normalizePagination(query.page, query.limit, { defaultLimit: 10 });

      const [sellers, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: SELLER_SELECT,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        // Scoped to SELLER — previously this counted all users.
        prisma.user.count({ where }),
      ]);

      return res.status(200).json({
        sellers,
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const password = String(body.password || "");

      if (!email || !name) throw ApiError.badRequest("A seller name and email are required.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest("Please enter a valid email address.");
      if (password && password.length < 8) throw ApiError.badRequest("Password must be at least 8 characters.");

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new ApiError(409, "A user with that email already exists.");

      const generated = password || `Seller${Math.random().toString(36).slice(2, 8)}!${Date.now().toString(36).slice(-3)}`;

      const seller = await prisma.user.create({
        data: {
          email,
          name,
          role: ROLES.SELLER,
          status: true,
          phone: body.phone ? String(body.phone).trim() : null,
          password: await bcrypt.hash(generated, 10),
        },
        select: SELLER_SELECT,
      });

      return res.status(201).json({
        seller: serializeUser(seller),
        // Returned once so the admin can hand it over; never stored in plain text.
        temporaryPassword: password ? undefined : generated,
        message: "Seller account created.",
      });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const id = String(body.id || query.id || "");
      if (!id) throw ApiError.badRequest("A seller id is required.");

      const target = await prisma.user.findFirst({ where: { id, role: ROLES.SELLER }, select: SELLER_SELECT });
      if (!target) throw ApiError.notFound("Seller not found.");

      const data = {};
      if (body.status !== undefined) data.status = toBoolean(body.status);
      if (body.name !== undefined) data.name = String(body.name).trim() || target.name;
      if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;

      if (Object.keys(data).length === 0) {
        throw ApiError.badRequest("Nothing to update. Provide status, name or phone.");
      }

      const seller = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({ where: { id }, data, select: SELLER_SELECT });

        // A disabled seller's catalogue must disappear from the storefront.
        if (data.status === false) {
          await tx.product.updateMany({
            where: { sellerId: id, status: { not: PRODUCT_STATUS.INACTIVE } },
            data: { status: PRODUCT_STATUS.INACTIVE },
          });
        } else if (data.status === true) {
          await tx.product.updateMany({
            where: { sellerId: id, status: PRODUCT_STATUS.INACTIVE },
            data: { status: PRODUCT_STATUS.ACTIVE },
          });
        }

        return updated;
      });

      return res.status(200).json({ seller: serializeUser(seller), message: "Seller updated." });
    }

    if (req.method === "DELETE") {
      const id = String(query.id || req.body?.id || "");
      if (!id) throw ApiError.badRequest("A seller id is required.");

      const target = await prisma.user.findFirst({ where: { id, role: ROLES.SELLER }, select: SELLER_SELECT });
      if (!target) throw ApiError.notFound("Seller not found.");

      const force = query.force === "1" || query.force === "true" || req.body?.force === true;
      const [products, orders] = await Promise.all([
        prisma.product.count({ where: { sellerId: id } }),
        prisma.order.count({ where: { sellerId: id } }),
      ]);

      if (!force && (products > 0 || orders > 0)) {
        throw new ApiError(
          409,
          `This seller owns ${products} product(s) and ${orders} order(s). Deleting the account will permanently remove them. Prefer disabling instead, or re-send with force=true to confirm.`,
          // Structured counts for the console's confirmation dialog.
          { products, orders }
        );
      }

      await prisma.user.delete({ where: { id } });
      return res.status(200).json({ message: "Seller deleted.", id, removed: { products, orders } });
    }

    return methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Admin seller operation failed.");
  }
}
