/**
 * Cart business logic.
 *
 * Fixes applied versus the previous implementation:
 *   - `prisma.cartItem.delete({ where: { id: productId, cartId } })` is invalid:
 *     Prisma's `delete` only accepts a *unique* `where`. It now uses the
 *     `cartId_productId` compound unique generated from @@unique([cartId, productId]).
 *   - Setting a quantity of 0 (or below) now removes the line item instead of
 *     persisting a nonsensical zero-quantity row.
 *   - `cart.findFirst` without `include` was read and then `.items` accessed,
 *     which was always undefined. Items are now included wherever they are used.
 *   - Totals (subtotal / discount / shipping / tax / total) are computed in one
 *     place, shared by the cart API, the checkout API and the order service so
 *     the customer can never be charged two different amounts.
 */
import prisma from "@/lib/prisma";
import { PRODUCT_STATUS, SHIPPING_FEE, TAX_RATE, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { effectivePrice, round2 } from "@/utils/format";

const CART_INCLUDE = {
  items: {
    orderBy: { id: "asc" },
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

/** Get the cart for a user (or null). */
export async function getCart(userId) {
  if (!userId) return null;
  return prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
}

/** Get the cart for a user, creating it on first use. */
export async function getOrCreateCart(userId) {
  if (!userId) throw Object.assign(new Error("A signed-in user is required."), { status: 401 });

  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });

  await prisma.cart.create({ data: { userId } });
  return prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
}

/**
 * Add a product to the cart, validating stock and product availability.
 * @returns the updated cart with items included
 */
export async function addToCart(userId, productId, quantity = 1) {
  const qty = Number.parseInt(quantity, 10);
  if (!Number.isFinite(qty) || qty < 1) {
    throw Object.assign(new Error("Quantity must be at least 1."), { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: String(productId) } });
  if (!product) throw Object.assign(new Error("Product not found."), { status: 404 });

  if (product.status === PRODUCT_STATUS.INACTIVE) {
    throw Object.assign(new Error("This product is no longer available."), { status: 400 });
  }
  if (product.stock < 1) {
    throw Object.assign(new Error(`${product.name} is out of stock.`), { status: 409 });
  }

  const cart = await getOrCreateCart(userId);
  const existingItem = cart.items.find((item) => item.productId === product.id);
  const nextQuantity = existingItem ? existingItem.quantity + qty : qty;

  if (nextQuantity > product.stock) {
    throw Object.assign(
      new Error(`Only ${product.stock} unit(s) of ${product.name} available (you requested ${nextQuantity}).`),
      { status: 409 }
    );
  }

  if (existingItem) {
    await prisma.cartItem.update({ where: { id: existingItem.id }, data: { quantity: nextQuantity } });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: qty },
    });
  }

  return getCart(userId);
}

/** Remove a product from the cart. */
export async function removeFromCart(userId, productId) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return getOrCreateCart(userId);

  // Use the compound unique key — `delete` cannot take a non-unique where.
  await prisma.cartItem
    .delete({ where: { cartId_productId: { cartId: cart.id, productId: String(productId) } } })
    .catch((error) => {
      // P2025 == row already absent; treat as a no-op so the UI stays in sync.
      if (error?.code !== "P2025") throw error;
    });

  return getCart(userId);
}

/** Update the quantity of a cart line. quantity <= 0 removes the line. */
export async function updateCartQuantity(userId, productId, quantity) {
  const qty = Number.parseInt(quantity, 10);
  if (!Number.isFinite(qty)) {
    throw Object.assign(new Error("Quantity must be a number."), { status: 400 });
  }

  const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
  if (!cart) throw Object.assign(new Error("Cart not found."), { status: 404 });

  const item = cart.items.find((i) => i.productId === String(productId));
  if (!item) throw Object.assign(new Error("That product is not in your cart."), { status: 404 });

  if (qty < 1) return removeFromCart(userId, productId);

  const product = await prisma.product.findUnique({ where: { id: item.productId } });
  if (!product) throw Object.assign(new Error("Product not found."), { status: 404 });

  if (qty > product.stock) {
    throw Object.assign(new Error(`Only ${product.stock} unit(s) of ${product.name} available.`), {
      status: 409,
    });
  }

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: qty } });
  return getCart(userId);
}

/** Empty the cart (keeps the Cart row so the relation stays stable). */
export async function clearCart(userId) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return getOrCreateCart(userId);

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(userId);
}

/**
 * Compute cart lines and totals.
 * This is the single source of truth for money — the checkout flow and the
 * order service both consume it, so displayed and charged totals always match.
 */
export function summarizeCart(cart) {
  const items = (cart?.items || [])
    .map((item) => {
      const product = item.product;
      const unitPrice = effectivePrice(product);
      const listPrice = round2(product?.price ?? 0);
      const quantity = Number(item.quantity) || 0;
      return {
        id: item.id,
        productId: item.productId,
        quantity,
        name: product?.name || "Unavailable product",
        slug: product?.slug,
        image: product?.images,
        sellerId: product?.sellerId,
        sellerName: product?.seller?.name || null,
        stock: product?.stock ?? 0,
        status: product?.status,
        unitPrice,
        listPrice,
        hasDiscount: (Number(product?.discount) || 0) > 0,
        lineTotal: round2(unitPrice * quantity),
        exceedsStock: quantity > (product?.stock ?? 0),
        unavailable: !product || product?.status === PRODUCT_STATUS.INACTIVE,
      };
    })
    // Stable ordering so the UI does not shuffle between requests.
    .sort((a, b) => String(a.productId).localeCompare(String(b.productId)));

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
  const listSubtotal = round2(items.reduce((sum, i) => sum + i.listPrice * i.quantity, 0));
  const discount = round2(Math.max(0, listSubtotal - subtotal));

  const qualifiesForFreeShipping =
    FREE_SHIPPING_THRESHOLD > 0 && subtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = itemCount === 0 || qualifiesForFreeShipping ? 0 : round2(SHIPPING_FEE);
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + shipping + tax);

  return {
    items,
    itemCount,
    subtotal,
    discount,
    shipping,
    tax,
    total,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    hasIssues: items.some((i) => i.exceedsStock || i.unavailable),
  };
}

/** Convenience: cart + computed summary in one call. */
export async function getCartWithSummary(userId) {
  const cart = await getOrCreateCart(userId);
  const summary = summarizeCart(cart);
  return { cartId: cart.id, ...summary };
}
