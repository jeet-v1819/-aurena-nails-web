/**
 * /api/admin/orders  — ADMIN only.
 *
 * GET    ?search=&status=&paymentStatus=&seller=&customer=&from=&to=&page=&limit=
 * GET    ?id=...                          single order + tracking timeline
 * PUT    body {id,status,note?,trackingNumber?,force?}   update status
 * DELETE ?id=...                          delete an order
 *
 * SECURITY FIX: no authentication before — any visitor could read every order in
 * the platform (including customer names, emails and addresses) and rewrite
 * order statuses.
 *
 * Other fixes:
 *   - `search` built `where.OR` with two `user` relation filters in the same OR
 *     array, which is valid, but status/seller/customer were applied without
 *     validating the values, so a typo produced a Prisma error -> 500.
 *   - PUT accepted any status string. It now goes through
 *     orderService.updateOrderStatus(), which whitelists statuses, enforces the
 *     transition map (bypassable by admins with force=true), records an
 *     OrderEvent for the tracking timeline and restocks cancelled orders.
 *   - `const { id } = req.query || req.body` never fell through to the body.
 *   - `totalPages` divided by the raw query string instead of a number.
 */
import { respondWithError, methodNotAllowed, ApiError } from "@/lib/apiError";
import { requireAdmin } from "@/lib/auth";
import { ORDER_STATUS } from "@/lib/constants";
import {
  deleteOrder,
  getAllOrders,
  getOrderById,
  getOrderTimeline,
  updateOrderStatus,
} from "@/services/orderService";
import { serializeOrder, serializeOrders } from "@/utils/serialize";

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    const query = req.query || {};

    if (req.method === "GET") {
      if (query.id) {
        const order = await getOrderById(String(query.id), admin);
        const timeline = await getOrderTimeline(order.id);
        return res.status(200).json({ order: serializeOrder(order), timeline });
      }

      const result = await getAllOrders(query);
      return res.status(200).json({
        orders: serializeOrders(result.orders),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const id = String(body.id || query.id || "");
      if (!id) throw ApiError.badRequest("An order id is required.");

      const status = String(body.status || "").toUpperCase();
      if (!status) throw ApiError.badRequest("status is required.");
      if (!Object.values(ORDER_STATUS).includes(status)) {
        throw ApiError.badRequest(`Invalid status. Expected one of: ${Object.values(ORDER_STATUS).join(", ")}.`);
      }

      const order = await updateOrderStatus(id, status, admin, {
        note: body.note,
        trackingNumber: body.trackingNumber,
        force: body.force === true,
      });

      return res.status(200).json({ order: serializeOrder(order), message: `Order marked ${status}.` });
    }

    if (req.method === "DELETE") {
      const id = String(query.id || req.body?.id || "");
      if (!id) throw ApiError.badRequest("An order id is required.");

      await deleteOrder(id);
      return res.status(200).json({ message: "Order deleted.", id });
    }

    return methodNotAllowed(res, ["GET", "PUT", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Admin order operation failed.");
  }
}
