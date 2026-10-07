/**
 * Wishlist business logic.
 *
 * Fixes applied versus the previous implementation:
 *   - `prisma.wishlistItem.delete({ where: { id: productId, wishlistId } })` is
 *     invalid (non-unique `where`). Now uses the `wishlistId_productId`
 *     compound unique generated from @@unique([wishlistId, productId]).
 *   - `moveToCart` swallowed stock/availability errors from addToCart and could
 *     delete the wishlist row even when the cart add failed; it is now atomic
 *     in ordering (add first, then remove) so a failure cannot lose the item.
 *   - `clearWishlist` read `wishlist.items` without including the relation.
 */
import prisma from "@/lib/prisma";
import { PRODUCT_STATUS } from "@/lib/constants";
import { effectivePrice, primaryImage, round2 } from "@/utils/format";
import { addToCart } from "./cartService.js";

const WISHLIST_INCLUDE = {
  items: {
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          seller: { select: { id: true, name: true } },
        },
      },
    },
  },
};

/** Get the wishlist for a user (or null). */
export async function getWishlist(userId) {
  if (!userId) return null;
  return prisma.wishlist.findUnique({ where: { userId }, include: WISHLIST_INCLUDE });
}

/** Get the wishlist for a user, creating it on first use. */
export async function getOrCreateWishlist(userId) {
  if (!userId) throw Object.assign(new Error("A signed-in user is required."), { status: 401 });

  const existing = await prisma.wishlist.findUnique({ where: { userId } });
  if (!existing) await prisma.wishlist.create({ data: { userId } });

  return prisma.wishlist.findUnique({ where: { userId }, include: WISHLIST_INCLUDE });
}

/** Add a product to the wishlist. Idempotent. */
export async function addToWishlist(userId, productId) {
  const product = await prisma.product.findUnique({ where: { id: String(productId) } });
  if (!product) throw Object.assign(new Error("Product not found."), { status: 404 });

  const wishlist = await getOrCreateWishlist(userId);
  const already = wishlist.items.some((item) => item.productId === product.id);

  if (!already) {
    await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId: product.id } });
  }

  return getWishlist(userId);
}

/** Remove a product from the wishlist. */
export async function removeFromWishlist(userId, productId) {
  const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
  if (!wishlist) return getOrCreateWishlist(userId);

  await prisma.wishlistItem
    .delete({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId: String(productId) } },
    })
    .catch((error) => {
      if (error?.code !== "P2025") throw error;
    });

  return getWishlist(userId);
}

/**
 * Toggle membership; returns the wishlist plus whether the product is now saved.
 * Handy for the heart button on product cards.
 */
export async function toggleWishlist(userId, productId) {
  const wishlist = await getOrCreateWishlist(userId);
  const present = wishlist.items.some((item) => item.productId === String(productId));
  const updated = present
    ? await removeFromWishlist(userId, productId)
    : await addToWishlist(userId, productId);
  return { wishlist: updated, saved: !present };
}

/** Move a product from the wishlist into the cart. */
export async function moveToCart(userId, productId, quantity = 1) {
  // Add to the cart FIRST so a stock failure cannot silently drop the item.
  await addToCart(userId, productId, quantity);
  await removeFromWishlist(userId, productId);
  return getWishlist(userId);
}

/** Empty the wishlist. */
export async function clearWishlist(userId) {
  const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
  if (!wishlist) return getOrCreateWishlist(userId);

  await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
  return getWishlist(userId);
}

/** Shape a wishlist for the API/UI. */
export function summarizeWishlist(wishlist) {
  const items = (wishlist?.items || []).map((item) => {
    const product = item.product;
    return {
      id: item.id,
      productId: item.productId,
      addedAt: item.createdAt,
      name: product?.name || "Unavailable product",
      slug: product?.slug,
      image: primaryImage(product?.images),
      price: round2(product?.price ?? 0),
      unitPrice: effectivePrice(product),
      discount: Number(product?.discount) || 0,
      stock: product?.stock ?? 0,
      status: product?.status,
      sellerId: product?.sellerId,
      sellerName: product?.seller?.name || null,
      averageRating: product?.averageRating ?? 0,
      inStock: (product?.stock ?? 0) > 0 && product?.status !== PRODUCT_STATUS.INACTIVE,
    };
  });

  return { items, count: items.length };
}

/** Convenience: wishlist + summary in one call. */
export async function getWishlistWithSummary(userId) {
  const wishlist = await getOrCreateWishlist(userId);
  return { wishlistId: wishlist.id, ...summarizeWishlist(wishlist) };
}
