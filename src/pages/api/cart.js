/**
 * /api/cart
 *
 * GET    — the signed-in user's cart, with line totals and an order summary.
 * POST   — add an item.            body: { productId, quantity }
 * PUT    — change an item's qty.   body: { productId, quantity }  (qty < 1 removes)
 * DELETE — remove an item.         query: ?productId=...
 *          (or ?clear=1 to empty the whole cart)
 *
 * SECURITY FIX: the previous implementation read `userId` straight out of
 * `req.query`, so ANY caller could read and mutate ANY user's cart by passing
 * someone else's id. The user id is now taken exclusively from the verified
 * session cookie.
 *
 * Other fixes: `cart.findFirst({ where: { userId } })` was called without
 * `include: { items: true }` and then `.items` was read (always undefined),
 * `prisma.cart.create({ data: { items: [] } })` passed an invalid nested write,
 * and responses omitted totals so the UI had to recompute money client-side.
 */
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAuth } from "@/lib/auth";
import {
  addToCart,
  clearCart,
  getCartWithSummary,
  removeFromCart,
  updateCartQuantity,
} from "@/services/cartService";

/** Uniform response shape for every cart mutation. */
async function cartResponse(res, userId, status = 200) {
  const summary = await getCartWithSummary(userId);
  return res.status(status).json(summary);
}

export default async function handler(req, res) {
  try {
    const user = await requireAuth(req, res);

    if (req.method === "GET") {
      return cartResponse(res, user.id);
    }

    if (req.method === "POST") {
      const { productId, quantity } = req.body || {};
      if (!productId) return res.status(400).json({ error: "productId is required." });

      await addToCart(user.id, String(productId), quantity ?? 1);
      return cartResponse(res, user.id, 201);
    }

    if (req.method === "PUT") {
      const { productId, quantity } = req.body || {};
      if (!productId) return res.status(400).json({ error: "productId is required." });
      if (quantity === undefined || quantity === null || quantity === "") {
        return res.status(400).json({ error: "quantity is required." });
      }

      await updateCartQuantity(user.id, String(productId), quantity);
      return cartResponse(res, user.id);
    }

    if (req.method === "DELETE") {
      const clear = req.query?.clear === "1" || req.query?.clear === "true";
      if (clear) {
        await clearCart(user.id);
        return cartResponse(res, user.id);
      }

      const productId = req.query?.productId || req.body?.productId;
      if (!productId) return res.status(400).json({ error: "productId is required." });

      await removeFromCart(user.id, String(productId));
      return cartResponse(res, user.id);
    }

    return methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Cart operation failed.");
  }
}
