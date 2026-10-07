/**
 * /api/orders
 *
 * GET  — the signed-in customer's order history (paginated, ?status= filter).
 *        Admins are redirected to the full list; sellers see only their own.
 * POST — checkout: turns the current cart into one order PER SELLER.
 *        body: { shippingAddress:{fullName,phone,line1,line2,city,state,postalCode,country},
 *                paymentMethod?, notes?, saveAddress?, shippingAddressId? }
 *
 * This endpoint did not exist before — there was no way for the customer flow
 * (cart -> checkout -> order confirmation -> order history) to complete, even
 * though orderService.createOrder() was implemented.
 *
 * PAYMENT: no real gateway is configured. The checkout below records a
 * SIMULATED payment; no processor is contacted and no card data is accepted.
 */
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAuth } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { checkout, getAllOrders, getOrdersBySeller, getOrdersByUser } from "@/services/orderService";
import { serializeOrders } from "@/utils/serialize";

export default async function handler(req, res) {
  try {
    const user = await requireAuth(req, res);

    if (req.method === "GET") {
      const query = req.query || {};

      if (user.role === ROLES.ADMIN) {
        const result = await getAllOrders(query);
        return res.status(200).json({
          orders: serializeOrders(result.orders),
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        });
      }

      if (user.role === ROLES.SELLER) {
        const result = await getOrdersBySeller(user.id, query);
        return res.status(200).json({
          orders: serializeOrders(result.orders),
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        });
      }

      const result = await getOrdersByUser(user.id, query);
      return res.status(200).json({
        orders: serializeOrders(result.orders),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    }

    if (req.method === "POST") {
      // Only customers place orders; admins/sellers have no shopping cart flow.
      if (user.role !== ROLES.CUSTOMER) {
        return res.status(403).json({ error: "Only customer accounts can place orders." });
      }

      const body = req.body || {};
      const result = await checkout({
        userId: user.id,
        shippingAddress: body.shippingAddress,
        shippingAddressId: body.shippingAddressId || null,
        paymentMethod: body.paymentMethod || "MOCK",
        notes: body.notes || null,
        saveAddress: Boolean(body.saveAddress),
      });

      return res.status(201).json({
        message: "Order placed successfully.",
        orders: serializeOrders(result.orders),
        orderIds: result.orderIds,
        orderNumbers: result.orderNumbers,
        summary: result.summary,
        payment: result.payment,
      });
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    return respondWithError(res, error, "Order operation failed.");
  }
}
