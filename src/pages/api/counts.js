/**
 * /api/counts
 *
 * Lightweight badge counts for the header (cart items + wishlist items).
 * Kept as its own endpoint so the header never has to download the full cart and
 * wishlist payloads just to render two numbers.
 *
 * GET — signed-in users only. Anonymous visitors get zeros rather than a 401, so
 * the header can call it unconditionally on every page without handling errors.
 */
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { getSessionUser } from "@/lib/auth";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

    const user = await getSessionUser(req, res);
    if (!user) {
      return res.status(200).json({ authenticated: false, cartCount: 0, cartItems: 0, wishlistCount: 0 });
    }

    const [cartItems, wishlistCount, pendingOrders] = await Promise.all([
      prisma.cartItem.findMany({
        where: { cart: { userId: user.id } },
        select: { quantity: true },
      }),
      prisma.wishlistItem.count({ where: { wishlist: { userId: user.id } } }),
      // Sellers/admins show an "orders needing attention" badge.
      user.role === "CUSTOMER"
        ? prisma.order.count({ where: { userId: user.id, status: "PENDING" } })
        : prisma.order.count({
            where: user.role === "SELLER" ? { sellerId: user.id, status: "PENDING" } : { status: "PENDING" },
          }),
    ]);

    const cartCount = cartItems.length;
    const cartQuantity = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    return res.status(200).json({
      authenticated: true,
      role: user.role,
      cartCount,
      cartItems: cartQuantity,
      wishlistCount,
      pendingOrders,
    });
  } catch (error) {
    return respondWithError(res, error, "Failed to load counts.");
  }
}
