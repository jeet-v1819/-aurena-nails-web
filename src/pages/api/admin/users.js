/**
 * /api/admin/users  — ADMIN only.
 *
 * GET    ?search=&role=&status=&page=&limit=        paginated user list
 * GET    ?id=...                                    single user
 * PUT    body { id, role?, status?, name?, phone? } change role / enable / disable
 * DELETE ?id=...                                    delete a user
 *
 * SECURITY FIX: this route previously had NO authentication whatsoever — anyone
 * could list every user, promote themselves to ADMIN, disable accounts or
 * delete rows with a plain curl request. Every branch now calls requireAdmin().
 *
 * Other fixes:
 *   - `const { id } = req.query || req.body` only ever read req.query (it is
 *     never nullish in Next.js), so a DELETE with the id in the body silently
 *     failed. Both sources are now checked.
 *   - PUT accepted an arbitrary `role` string; roles are whitelisted.
 *   - Admins can no longer demote, disable or delete their own account.
 *   - Deleting a user who owns products/orders requires ?force=true, because
 *     the schema cascades and would destroy catalogue and order history.
 */
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed, ApiError } from "@/lib/apiError";
import { requireAdmin } from "@/lib/auth";
import { ROLES, ROLE_VALUES } from "@/lib/constants";
import { normalizePagination } from "@/utils/format";
import { toBoolean } from "@/utils/query";
import { serializeUser } from "@/utils/serialize";
import { searchOr } from "@/utils/query";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  phone: true,
  address: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(query) {
  const where = {};
  const { search, role, status } = query;

  if (search) {
    const or = searchOr(search, ["name", "email", "phone"]);
    if (or) where.OR = or;
  }
  if (role && ROLE_VALUES.includes(String(role).toUpperCase())) {
    where.role = String(role).toUpperCase();
  }
  if (status !== undefined && status !== "") {
    where.status = toBoolean(status);
  }
  return where;
}

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    const query = req.query || {};

    if (req.method === "GET") {
      if (query.id) {
        const user = await prisma.user.findUnique({
          where: { id: String(query.id) },
          select: USER_SELECT,
        });
        if (!user) throw ApiError.notFound("User not found.");

        const [productCount, orderCount] = await Promise.all([
          prisma.product.count({ where: { sellerId: user.id } }),
          prisma.order.count({ where: { userId: user.id } }),
        ]);

        return res.status(200).json({ user, stats: { productCount, orderCount } });
      }

      const where = buildWhere(query);
      const { page, limit, skip } = normalizePagination(query.page, query.limit, { defaultLimit: 10 });

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: USER_SELECT,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return res.status(200).json({
        users,
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const id = String(body.id || query.id || "");
      if (!id) throw ApiError.badRequest("A user id is required.");

      const target = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
      if (!target) throw ApiError.notFound("User not found.");

      const data = {};

      if (body.role !== undefined) {
        const role = String(body.role).toUpperCase();
        if (!ROLE_VALUES.includes(role)) {
          throw ApiError.badRequest(`Invalid role. Expected one of: ${ROLE_VALUES.join(", ")}.`);
        }
        if (id === admin.id && role !== ROLES.ADMIN) {
          throw ApiError.badRequest("You cannot remove your own admin role.");
        }
        data.role = role;
      }

      if (body.status !== undefined) {
        const status = toBoolean(body.status);
        if (id === admin.id && status === false) {
          throw ApiError.badRequest("You cannot disable your own account.");
        }
        data.status = status;
      }

      if (body.name !== undefined) data.name = String(body.name).trim() || null;
      if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
      if (body.address !== undefined) data.address = body.address ? String(body.address).trim() : null;

      if (Object.keys(data).length === 0) {
        throw ApiError.badRequest("Nothing to update. Provide role, status, name, phone or address.");
      }

      const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
      return res.status(200).json({ user: serializeUser(user), message: "User updated." });
    }

    if (req.method === "DELETE") {
      const id = String(query.id || req.body?.id || "");
      if (!id) throw ApiError.badRequest("A user id is required.");
      if (id === admin.id) throw ApiError.badRequest("You cannot delete your own account.");

      const target = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
      if (!target) throw ApiError.notFound("User not found.");

      const force = query.force === "1" || query.force === "true" || req.body?.force === true;
      const [products, orders] = await Promise.all([
        prisma.product.count({ where: { sellerId: id } }),
        prisma.order.count({ where: { OR: [{ userId: id }, { sellerId: id }] } }),
      ]);

      if (!force && (products > 0 || orders > 0)) {
        throw new ApiError(
          409,
          `This account owns ${products} product(s) and ${orders} order(s). Deleting it will permanently remove them. Re-send with force=true to confirm.`,
          // Structured counts so the console can render a precise confirmation
          // dialog instead of only showing this sentence.
          { products, orders }
        );
      }

      await prisma.user.delete({ where: { id } });
      return res.status(200).json({ message: "User deleted.", id, removed: { products, orders } });
    }

    return methodNotAllowed(res, ["GET", "PUT", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Admin user operation failed.");
  }
}
