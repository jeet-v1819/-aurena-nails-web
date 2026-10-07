/**
 * Order, checkout and review business logic.
 *
 * Fixes / changes versus the previous implementation:
 *   - MULTI-VENDOR CHECKOUT. The old createOrder() took a single `sellerId` and
 *     attached the whole cart to one seller, which is wrong for a marketplace.
 *     `checkout()` now groups the cart by product.sellerId and creates one Order
 *     per seller, so each vendor only ever sees and ships their own items.
 *   - Stock decrement + order creation + cart clearing now happen inside a
 *     single `prisma.$transaction`, so an out-of-stock item can never leave a
 *     half-created order or a permanently decremented stock count.
 *   - `getOrderById(orderId, userId)` ignored its `userId` argument entirely —
 *     any signed-in user could read any order by guessing an id. Access is now
 *     enforced (owner, the order's seller, or an admin).
 *   - `updateOrderStatus` accepted any string. Statuses are now validated and
 *     constrained to a legal transition map, and every change is recorded in
 *     OrderEvent so customers get a real tracking timeline.
 *   - Cancelling an order now restores stock.
 *
 * PAYMENT: there is no real payment gateway configured in this project. The
 * flow below is a SIMULATED/mock payment. Nothing here contacts a processor and
 * no card data is handled. paymentMethod is stored as a label only.
 */
import prisma from "@/lib/prisma";
import {
  CANCELLABLE_ORDER_STATUSES,
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  PRODUCT_STATUS,
  ROLES,
  ORDER_STATUS_TRANSITIONS as STATUS_TRANSITIONS,
  SELLER_ALLOWED_STATUSES,
} from "@/lib/constants";
import { normalizePagination, round2 } from "@/utils/format";
import { summarizeCart } from "./cartService.js";

/**
 * Legal status transitions and the seller's restricted status list now live in
 * @/lib/constants so the console UIs can offer exactly the choices this service
 * will accept (a single source of truth instead of a duplicated map). They are
 * re-exported at the bottom of this file for existing server-side importers.
 */

const ORDER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  seller: { select: { id: true, name: true, email: true } },
  items: {
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
  events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { id: true, name: true, role: true } } } },
  shippingAddressRef: true,
};

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/** Build a collision-resistant, human-readable order number. */
function generateOrderNumber(salt = 0) {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${Date.now().toString(36).toUpperCase()}-${salt}-${rand}`;
}

/** Render an address object into the single-line snapshot stored on the order. */
export function formatShippingAddress(address = {}) {
  const parts = [
    address.fullName,
    address.phone,
    address.line1,
    address.line2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country,
  ].filter((part) => part && String(part).trim());
  return parts.join(" | ");
}

/**
 * Create orders from the current cart — one order per seller.
 *
 * @param {object} params
 * @param {string} params.userId            the customer placing the order
 * @param {object} params.shippingAddress   {fullName, phone, line1, line2, city, state, postalCode, country}
 * @param {string} [params.shippingAddressId] existing saved Address row to link
 * @param {string} [params.paymentMethod]   MOCK | COD | CARD | UPI (simulated)
 * @param {string} [params.notes]
 * @param {boolean} [params.saveAddress]    persist the address for reuse
 */
export async function checkout({
  userId,
  shippingAddress,
  shippingAddressId = null,
  paymentMethod = "MOCK",
  notes = null,
  saveAddress = false,
}) {
  if (!userId) throw httpError(401, "You must be signed in to place an order.");

  const address = shippingAddress || {};
  if (!address.fullName || !address.line1 || !address.city || !address.state || !address.postalCode) {
    throw httpError(400, "Please provide a complete shipping address (name, address, city, state and postal code).");
  }

  const method = String(paymentMethod || "MOCK").toUpperCase();
  if (!PAYMENT_METHODS.includes(method)) {
    throw httpError(400, `Unsupported payment method. Choose one of: ${PAYMENT_METHODS.join(", ")}.`);
  }

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw httpError(400, "Your cart is empty — add something before checking out.");
  }

  // Fail fast on unavailable/over-quantity lines before writing anything.
  for (const item of cart.items) {
    const product = item.product;
    if (!product) throw httpError(400, "A product in your cart no longer exists. Please remove it.");
    if (product.status === PRODUCT_STATUS.INACTIVE) {
      throw httpError(409, `${product.name} is no longer available. Please remove it from your cart.`);
    }
    if (product.stock < item.quantity) {
      throw httpError(409, `Only ${product.stock} unit(s) of ${product.name} are available (you requested ${item.quantity}).`);
    }
  }

  const addressSnapshot = formatShippingAddress(address);
  const summary = summarizeCart(cart);

  // Group by seller: a marketplace order is split per vendor.
  const bySeller = new Map();
  for (const item of cart.items) {
    const sellerId = item.product.sellerId;
    if (!bySeller.has(sellerId)) bySeller.set(sellerId, []);
    bySeller.get(sellerId).push(item);
  }

  const orders = await prisma.$transaction(async (tx) => {
    let linkedAddressId = shippingAddressId || null;

    if (!linkedAddressId && saveAddress) {
      const created = await tx.address.create({
        data: {
          userId,
          type: "SHIPPING",
          label: address.label || "Home",
          fullName: String(address.fullName),
          phone: address.phone ? String(address.phone) : null,
          line1: String(address.line1),
          line2: address.line2 ? String(address.line2) : null,
          city: String(address.city),
          state: String(address.state),
          postalCode: String(address.postalCode),
          country: address.country ? String(address.country) : "India",
          isDefault: Boolean(address.isDefault),
        },
      });
      linkedAddressId = created.id;
    }

    const createdOrders = [];
    let sellerIndex = 0;

    for (const [sellerId, items] of bySeller.entries()) {
      // Per-seller money: each vendor ships separately, so shipping and tax are
      // computed on that vendor's slice of the basket.
      const lines = items.map((item) => {
        const product = item.product;
        const listPrice = round2(product.price);
        const unitPrice = round2(product.discount > 0 && product.discountPrice != null ? product.discountPrice : listPrice);
        return {
          productId: product.id,
          quantity: item.quantity,
          price: unitPrice,
          total: round2(unitPrice * item.quantity),
          listTotal: round2(listPrice * item.quantity),
        };
      });

      const subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
      const listSubtotal = round2(lines.reduce((sum, l) => sum + l.listTotal, 0));
      const discount = round2(Math.max(0, listSubtotal - subtotal));

      // Shipping/tax are apportioned from the whole-basket summary so the sum of
      // the split orders equals exactly what the customer saw in the cart.
      const share = summary.subtotal > 0 ? subtotal / summary.subtotal : 1 / bySeller.size;
      const shipping = round2(summary.shipping * share);
      const tax = round2(summary.tax * share);
      const total = round2(subtotal + shipping + tax);

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(sellerIndex),
          status: ORDER_STATUS.PENDING,
          // Simulated payment: COD stays PENDING until delivery, everything else
          // is marked PAID by the mock gateway. No real processor is involved.
          paymentStatus: method === "COD" ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PAID,
          paymentMethod: method,
          subtotal,
          discount,
          shipping,
          tax,
          total,
          shippingAddress: addressSnapshot,
          notes: notes ? String(notes).slice(0, 1000) : null,
          userId,
          sellerId,
          shippingAddressId: linkedAddressId,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              price: line.price,
              total: line.total,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: ORDER_STATUS.PENDING,
          note:
            method === "COD"
              ? "Order placed. Cash on delivery — payment due on arrival."
              : "Order placed. Payment simulated (no real gateway configured).",
          actorId: userId,
        },
      });

      // Decrement stock atomically. The `stock: { gte }` guard makes the update
      // fail rather than go negative if two checkouts race.
      for (const line of lines) {
        const updated = await tx.product.updateMany({
          where: { id: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count === 0) {
          throw httpError(409, "An item in your cart just went out of stock. Please review your cart and try again.");
        }
        // Reflect an exhausted product in its status.
        const fresh = await tx.product.findUnique({ where: { id: line.productId }, select: { stock: true, status: true } });
        if (fresh && fresh.stock === 0 && fresh.status === PRODUCT_STATUS.ACTIVE) {
          await tx.product.update({ where: { id: line.productId }, data: { status: PRODUCT_STATUS.OUT_OF_STOCK } });
        }
      }

      createdOrders.push(order);
      sellerIndex += 1;
    }

    // Cart is consumed by the order(s).
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return createdOrders;
  });

  return {
    orders,
    orderIds: orders.map((o) => o.id),
    orderNumbers: orders.map((o) => o.orderNumber),
    summary: {
      subtotal: summary.subtotal,
      discount: summary.discount,
      shipping: summary.shipping,
      tax: summary.tax,
      total: summary.total,
    },
    payment: {
      method,
      simulated: true,
      note: "No real payment gateway is configured; payment was simulated.",
    },
  };
}

/**
 * Fetch one order with access control.
 * Allowed: the customer who placed it, the seller who fulfils it, or an admin.
 */
export async function getOrderById(orderId, actor) {
  if (!orderId) throw httpError(400, "An order id is required.");

  const order = await prisma.order.findUnique({ where: { id: String(orderId) }, include: ORDER_INCLUDE });
  if (!order) throw httpError(404, "Order not found.");

  const role = actor?.role;
  const isOwner = actor && String(actor.id) === String(order.userId);
  const isSeller = actor && String(actor.id) === String(order.sellerId);
  const isAdmin = role === ROLES.ADMIN;

  if (!actor || (!isOwner && !isSeller && !isAdmin)) {
    // 404 rather than 403 so we do not confirm that the order exists.
    throw httpError(404, "Order not found.");
  }

  return order;
}

/** Orders placed by a customer. */
export async function getOrdersByUser(userId, options = {}) {
  const { page, limit, skip } = normalizePagination(options.page, options.limit, { defaultLimit: 10 });

  const where = { userId };
  if (options.status && ORDER_STATUS_VALUES.includes(String(options.status).toUpperCase())) {
    where.status = String(options.status).toUpperCase();
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, slug: true, images: true } } } },
        events: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true } },
      },
      orderBy: { orderDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 };
}

/** Orders a seller must fulfil. */
export async function getOrdersBySeller(sellerId, options = {}) {
  const { page, limit, skip } = normalizePagination(options.page, options.limit, { defaultLimit: 10 });

  const where = { sellerId };
  if (options.status && ORDER_STATUS_VALUES.includes(String(options.status).toUpperCase())) {
    where.status = String(options.status).toUpperCase();
  }
  if (options.search) {
    where.OR = [{ orderNumber: { contains: String(options.search) } }, { user: { email: { contains: String(options.search) } } }];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: { product: { select: { id: true, name: true, slug: true, images: true, sku: true } } },
        },
        events: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true } },
      },
      orderBy: { orderDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 };
}

/** All orders, for the admin console. */
export async function getAllOrders(options = {}) {
  const { page, limit, skip } = normalizePagination(options.page, options.limit, { defaultLimit: 10 });

  const where = {};
  if (options.status && ORDER_STATUS_VALUES.includes(String(options.status).toUpperCase())) {
    where.status = String(options.status).toUpperCase();
  }
  if (options.paymentStatus) where.paymentStatus = String(options.paymentStatus).toUpperCase();
  if (options.seller) where.sellerId = options.seller;
  if (options.customer) where.userId = options.customer;
  if (options.search) {
    where.OR = [
      { orderNumber: { contains: String(options.search) } },
      { trackingNumber: { contains: String(options.search) } },
      { user: { email: { contains: String(options.search) } } },
      { user: { name: { contains: String(options.search) } } },
      { seller: { name: { contains: String(options.search) } } },
    ];
  }
  if (options.from || options.to) {
    where.orderDate = {};
    if (options.from) where.orderDate.gte = new Date(options.from);
    if (options.to) {
      // A bare "YYYY-MM-DD" parses as midnight, which would silently exclude
      // everything ordered later that day. Treat `to` as inclusive of the whole
      // day unless the caller already supplied a time component.
      const hasTime = /[T ]\d{2}:\d{2}/.test(String(options.to));
      const end = new Date(options.to);
      if (!hasTime && !Number.isNaN(end.getTime())) end.setUTCHours(23, 59, 59, 999);
      where.orderDate.lte = end;
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        // `images` is needed by serializeOrderItem to render a thumbnail; the
        // admin order table showed placeholders without it.
        items: { include: { product: { select: { id: true, name: true, slug: true, images: true } } } },
      },
      orderBy: { orderDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 };
}

/**
 * Move an order to a new status, recording a tracking event.
 *
 * @param {string} orderId
 * @param {string} status target status
 * @param {object} actor  session user performing the change
 * @param {object} [options] { note, trackingNumber, force }
 */
export async function updateOrderStatus(orderId, status, actor, options = {}) {
  const target = String(status || "").toUpperCase();
  if (!ORDER_STATUS_VALUES.includes(target)) {
    throw httpError(400, `Invalid order status. Expected one of: ${ORDER_STATUS_VALUES.join(", ")}.`);
  }

  const order = await prisma.order.findUnique({ where: { id: String(orderId) } });
  if (!order) throw httpError(404, "Order not found.");

  const isAdmin = actor?.role === ROLES.ADMIN;
  const isSeller = actor && String(actor.id) === String(order.sellerId);
  // The customer who placed the order. They are NOT a fulfilment actor.
  const isOwner = Boolean(actor) && String(actor.id) === String(order.userId);

  if (!isAdmin && !isSeller && !isOwner) {
    throw httpError(403, "You can only update orders belonging to your own store.");
  }

  /**
   * BUG FIXED: customer cancellation was impossible.
   *
   * cancelOrder() verified `actor.id === order.userId` and then delegated here,
   * but this function only recognised admins and the order's SELLER — so the
   * customer hit the "orders belonging to your own store" 403 and
   * PATCH /api/orders/[id] could never cancel anything. The README lists
   * "cancel orders" as a customer feature.
   *
   * Owners are now accepted, but on a strictly narrower path than sellers: the
   * only status they may set is CANCELLED, and only while the order is still
   * cancellable. Everything else (shipping, refunds, forcing transitions) still
   * requires the seller or an admin.
   */
  if (!isAdmin && !isSeller) {
    if (target !== ORDER_STATUS.CANCELLED) {
      throw httpError(403, "You can only cancel your own orders.");
    }
    if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
      throw httpError(
        409,
        `This order can no longer be cancelled (current status: ${order.status}). Please contact the seller.`
      );
    }
  }

  if (isSeller && !isAdmin && !SELLER_ALLOWED_STATUSES.includes(target)) {
    throw httpError(403, `Sellers cannot set an order to ${target}.`);
  }

  if (!isAdmin && !options.force) {
    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (target !== order.status && !allowed.includes(target)) {
      throw httpError(
        409,
        `Cannot move an order from ${order.status} to ${target}. Allowed next statuses: ${allowed.join(", ") || "none"}.`
      );
    }
  }

  if (order.status === target && !options.trackingNumber) {
    return prisma.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE });
  }

  const data = { status: target };
  if (options.trackingNumber !== undefined) data.trackingNumber = options.trackingNumber ? String(options.trackingNumber) : null;
  if (target === ORDER_STATUS.CANCELLED) data.cancelledAt = new Date();
  // A refund implies the money moved back.
  if (target === ORDER_STATUS.REFUNDED) data.paymentStatus = PAYMENT_STATUS.REFUNDED;
  if (target === ORDER_STATUS.DELIVERED && order.paymentStatus === PAYMENT_STATUS.PENDING) {
    data.paymentStatus = PAYMENT_STATUS.PAID;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.order.update({ where: { id: order.id }, data, include: ORDER_INCLUDE });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        status: target,
        note: options.note ? String(options.note).slice(0, 500) : defaultStatusNote(target, options.trackingNumber),
        actorId: actor?.id || null,
      },
    });

    // Restock when an unfulfilled order is cancelled.
    if (target === ORDER_STATUS.CANCELLED && CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        const fresh = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true, status: true } });
        if (fresh && fresh.stock > 0 && fresh.status === PRODUCT_STATUS.OUT_OF_STOCK) {
          await tx.product.update({ where: { id: item.productId }, data: { status: PRODUCT_STATUS.ACTIVE } });
        }
      }
    }

    return next;
  });

  return updated;
}

function defaultStatusNote(status, trackingNumber) {
  switch (status) {
    case ORDER_STATUS.CONFIRMED:
      return "Order confirmed by the seller.";
    case ORDER_STATUS.PROCESSING:
      return "Order is being prepared for dispatch.";
    case ORDER_STATUS.SHIPPED:
      return trackingNumber ? `Shipped. Tracking number ${trackingNumber}.` : "Order has been shipped.";
    case ORDER_STATUS.DELIVERED:
      return "Order delivered.";
    case ORDER_STATUS.CANCELLED:
      return "Order cancelled. Stock has been restored.";
    case ORDER_STATUS.REFUNDED:
      return "Refund issued.";
    default:
      return `Status changed to ${status}.`;
  }
}

/** Customer self-service cancellation. */
export async function cancelOrder(orderId, actor, reason) {
  const order = await prisma.order.findUnique({ where: { id: String(orderId) } });
  if (!order) throw httpError(404, "Order not found.");

  if (!actor || String(actor.id) !== String(order.userId)) {
    throw httpError(403, "You can only cancel your own orders.");
  }

  if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
    throw httpError(
      409,
      `This order can no longer be cancelled (current status: ${order.status}). Please contact the seller.`
    );
  }

  return updateOrderStatus(orderId, ORDER_STATUS.CANCELLED, actor, {
    note: reason ? `Cancelled by customer: ${String(reason).slice(0, 400)}` : "Cancelled by customer.",
  });
}

/** Full tracking timeline for an order. */
export async function getOrderTimeline(orderId) {
  return prisma.orderEvent.findMany({
    where: { orderId: String(orderId) },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
}

/** Delete an order (admin only). */
export async function deleteOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: String(orderId) } });
  if (!order) throw httpError(404, "Order not found.");
  return prisma.order.delete({ where: { id: order.id } });
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/** Add (or update) a review for a product. */
export async function addReview(userId, productId, rating, comment) {
  const score = Number.parseInt(rating, 10);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    throw httpError(400, "Rating must be a whole number between 1 and 5.");
  }

  const product = await prisma.product.findUnique({ where: { id: String(productId) } });
  if (!product) throw httpError(404, "Product not found.");

  const existing = await prisma.review.findUnique({
    where: { userId_productId: { userId, productId: product.id } },
  });

  const review = existing
    ? await prisma.review.update({
        where: { id: existing.id },
        data: { rating: score, comment: comment ? String(comment).slice(0, 2000) : null },
      })
    : await prisma.review.create({
        data: {
          rating: score,
          comment: comment ? String(comment).slice(0, 2000) : null,
          userId,
          productId: product.id,
        },
      });

  await recalculateProductRating(product.id);
  return review;
}

/** Remove a review (author or admin) and refresh the product rating. */
export async function deleteReview(reviewId, actor) {
  const review = await prisma.review.findUnique({ where: { id: String(reviewId) } });
  if (!review) throw httpError(404, "Review not found.");

  if (actor?.role !== ROLES.ADMIN && String(actor?.id) !== String(review.userId)) {
    throw httpError(403, "You can only delete your own review.");
  }

  await prisma.review.delete({ where: { id: review.id } });
  await recalculateProductRating(review.productId);
  return { id: review.id };
}

/** Keep Product.averageRating / reviewCount in sync. */
export async function recalculateProductRating(productId) {
  const aggregate = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return prisma.product.update({
    where: { id: productId },
    data: {
      averageRating: round2(aggregate._avg.rating || 0),
      reviewCount: aggregate._count.rating || 0,
    },
  });
}

/** Paginated reviews for a product. */
export async function getProductReviews(productId, options = {}) {
  const { page, limit, skip } = normalizePagination(options.page, options.limit, { defaultLimit: 10 });

  const where = { productId: String(productId) };
  if (options.rating) {
    const r = Number.parseInt(options.rating, 10);
    if (Number.isFinite(r) && r >= 1 && r <= 5) where.rating = r;
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);

  // Rating histogram for the summary bars on the product page.
  const grouped = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId: String(productId) },
    _count: { _all: true },
  });
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    rating: star,
    count: grouped.find((g) => g.rating === star)?._count?._all || 0,
  }));

  return {
    reviews,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    distribution,
  };
}

export { STATUS_TRANSITIONS, SELLER_ALLOWED_STATUSES };
