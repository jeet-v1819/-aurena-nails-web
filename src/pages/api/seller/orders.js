/**
 * /api/seller/orders  — SELLER only.
 *
 * GET ?status=&search=&page=&limit=   orders containing YOUR products
 * GET ?id=...                          one of YOUR orders + tracking timeline
 * PUT body {id,status,note?,trackingNumber?}   advance an order's status
 *
 * SECURITY FIX: `sellerId` used to come from `req.query`, so any caller could
 * list and rewrite any seller's orders. It now comes from the session.
 *
 * The PUT branch previously called `prisma.order.update()` directly with no
 * ownership check and no status validation — any signed-in visitor could set any
 * order to any status. It now goes through orderService.updateOrderStatus(),
 * which verifies the caller owns the order, whitelists statuses, restricts
 * sellers to fulfilment statuses (no refunds), enforces the transition map,
 * records an OrderEvent and restocks cancelled orders.
 *
 * DELETE is intentionally not offered to sellers — order history is a financial
 * record and only admins may remove it.
 */
import { respondWithError, methodNotAllowed, ApiError } from "@/lib/apiError";
import { requireSeller } from "@/lib/auth";
import { ORDER_STATUS } from "@/lib/constants";
import {
  SELLER_ALLOWED_STATUSES,
  getOrderById,
  getOrderTimeline,
  getOrdersBySeller,
  updateOrderStatus,
} from "@/services/orderService";
import { serializeOrder, serializeOrders } from "@/utils/serialize";

export default async function handler(req, res) {
  try {
    const user = await requireSeller(req, res);
    const query = req.query || {};
    const sellerId = user.id;

    if (req.method === "GET") {
      if (query.id) {
        const order = await getOrderById(String(query.id), user);
        const timeline = await getOrderTimeline(order.id);
        return res.status(200).json({ order: serializeOrder(order), timeline });
      }

      const result = await getOrdersBySeller(sellerId, {
        status: query.status,
        search: query.search,
        page: query.page,
        limit: query.limit,
      });

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
      if (user.role !== "ADMIN" && !SELLER_ALLOWED_STATUSES.includes(status)) {
        throw new ApiError(403, `Sellers cannot set an order to ${status}.`);
      }

      // Ownership is enforced inside updateOrderStatus as well; this early check
      // exists only to produce a clearer message.
      await getOrderById(id, user);

      const order = await updateOrderStatus(id, status, user, {
        note: body.note,
        trackingNumber: body.trackingNumber,
      });

      return res.status(200).json({ order: serializeOrder(order), message: `Order marked ${status}.` });
    }

    return methodNotAllowed(res, ["GET", "PUT"]);
  } catch (error) {
    return respondWithError(res, error, "Seller order operation failed.");
  }
}
