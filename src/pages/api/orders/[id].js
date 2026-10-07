/**
 * /api/orders/[id]
 *
 * GET    — order detail + tracking timeline.
 *          Access: the customer who placed it, the seller who fulfils it, or an
 *          admin. Everyone else gets 404 (not 403, so we do not confirm the
 *          order exists).
 * PUT    — update status / tracking number. Seller (own orders) or admin.
 *          body: { status, note?, trackingNumber? }
 * PATCH  — customer self-service cancellation. body: { reason? }
 * DELETE — admin only.
 *
 * Fixes: `getOrderById(orderId, userId)` previously accepted a userId argument
 * and then never used it in the query, so any id returned any order.
 * `updateOrderStatus` accepted arbitrary status strings with no validation and
 * no transition rules, and cancellation did not restore stock.
 */
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  cancelOrder,
  deleteOrder,
  getOrderById,
  getOrderTimeline,
  updateOrderStatus,
} from "@/services/orderService";
import { serializeOrder } from "@/utils/serialize";

export default async function handler(req, res) {
  const { id } = req.query || {};

  try {
    if (!id) return res.status(400).json({ error: "An order id is required." });

    const user = await requireAuth(req, res);

    if (req.method === "GET") {
      const order = await getOrderById(String(id), user);
      const events = await getOrderTimeline(order.id);
      return res.status(200).json({ order: serializeOrder(order), timeline: events });
    }

    if (req.method === "PUT") {
      if (user.role !== ROLES.SELLER && user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: "Only sellers and admins can update order status." });
      }

      const status = String(req.body?.status || "").toUpperCase();
      if (!status) return res.status(400).json({ error: "status is required." });

      const order = await updateOrderStatus(String(id), status, user, {
        note: req.body?.note,
        trackingNumber: req.body?.trackingNumber,
        force: user.role === ROLES.ADMIN && req.body?.force === true,
      });
      return res.status(200).json({ order: serializeOrder(order) });
    }

    if (req.method === "PATCH") {
      // Customer cancellation. Admins may also cancel through PUT.
      const order = await cancelOrder(String(id), user, req.body?.reason);
      return res.status(200).json({ order: serializeOrder(order), message: "Order cancelled." });
    }

    if (req.method === "DELETE") {
      await requireAdmin(req, res);
      await deleteOrder(String(id));
      return res.status(200).json({ message: "Order deleted.", id: String(id) });
    }

    return methodNotAllowed(res, ["GET", "PUT", "PATCH", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Failed to process order.");
  }
}
