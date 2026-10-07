/**
 * /api/wishlist
 *
 * GET    — the signed-in user's wishlist with product details.
 * POST   — add an item.        body: { productId }
 * PUT    — move to cart.       body: { productId, quantity }
 * DELETE — remove an item.     query: ?productId=...  (or ?clear=1 to empty)
 * PATCH  — toggle membership.  body/query: { productId }
 *
 * This endpoint did not exist before, even though the header, navigation and
 * README all linked to a /wishlist page and wishlistService.js was implemented.
 *
 * The user id comes from the session — never from the request body/query.
 */
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAuth } from "@/lib/auth";
import {
  addToWishlist,
  clearWishlist,
  getWishlistWithSummary,
  moveToCart,
  removeFromWishlist,
  toggleWishlist,
} from "@/services/wishlistService";
import { getCartWithSummary } from "@/services/cartService";

async function wishlistResponse(res, userId, status = 200, extra = {}) {
  const summary = await getWishlistWithSummary(userId);
  return res.status(status).json({ ...summary, ...extra });
}

export default async function handler(req, res) {
  try {
    const user = await requireAuth(req, res);

    if (req.method === "GET") {
      return wishlistResponse(res, user.id);
    }

    if (req.method === "POST") {
      const productId = req.body?.productId || req.query?.productId;
      if (!productId) return res.status(400).json({ error: "productId is required." });

      await addToWishlist(user.id, String(productId));
      return wishlistResponse(res, user.id, 201, { saved: true });
    }

    if (req.method === "PATCH") {
      const productId = req.body?.productId || req.query?.productId;
      if (!productId) return res.status(400).json({ error: "productId is required." });

      const { saved } = await toggleWishlist(user.id, String(productId));
      return wishlistResponse(res, user.id, 200, { saved });
    }

    if (req.method === "PUT") {
      const productId = req.body?.productId;
      if (!productId) return res.status(400).json({ error: "productId is required." });

      await moveToCart(user.id, String(productId), req.body?.quantity ?? 1);
      const cart = await getCartWithSummary(user.id);
      return wishlistResponse(res, user.id, 200, { movedToCart: true, cart });
    }

    if (req.method === "DELETE") {
      const clear = req.query?.clear === "1" || req.query?.clear === "true";
      if (clear) {
        await clearWishlist(user.id);
        return wishlistResponse(res, user.id);
      }

      const productId = req.query?.productId || req.body?.productId;
      if (!productId) return res.status(400).json({ error: "productId is required." });

      await removeFromWishlist(user.id, String(productId));
      return wishlistResponse(res, user.id);
    }

    return methodNotAllowed(res, ["GET", "POST", "PATCH", "PUT", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Wishlist operation failed.");
  }
}
