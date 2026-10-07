/**
 * Convert Prisma rows into the plain JSON shape the UI expects.
 *
 * Several columns store JSON inside a String (images/size/color/specifications)
 * so that one schema runs on SQLite and PostgreSQL. Without normalising here,
 * the frontend receives strings and guards like `Array.isArray(product.images)`
 * silently evaluate to false — which is why product images never rendered.
 */
import {
  effectivePrice,
  parseJsonArray,
  parseJsonObject,
  primaryImage,
  productImages,
  round2,
} from "./format";
import { PRODUCT_STATUS } from "@/lib/constants";

/** Never expose password hashes to the client. */
export function serializeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

export function serializeProduct(product) {
  if (!product) return null;

  const images = productImages(product.images);
  const price = round2(product.price);
  const unitPrice = effectivePrice(product);
  const discount = Number(product.discount) || 0;

  return {
    ...product,
    price,
    discount,
    discountPrice: product.discountPrice == null ? null : round2(product.discountPrice),
    unitPrice,
    images,
    image: images.length ? images[0] : primaryImage(null),
    size: parseJsonArray(product.size, []),
    color: parseJsonArray(product.color, []),
    specifications: parseJsonObject(product.specifications, {}),
    inStock: (product.stock ?? 0) > 0 && product.status !== PRODUCT_STATUS.INACTIVE,
    onSale: discount > 0 && unitPrice < price,
    rating: round2(product.averageRating ?? 0),
    // Nested relations may be objects, null, or absent depending on the caller.
    categoryName: product.category?.name ?? null,
    brandName: product.brand?.name ?? null,
    sellerId: product.sellerId ?? product.seller?.id ?? null,
    sellerName: product.seller?.name ?? null,
  };
}

export function serializeProducts(products) {
  return Array.isArray(products) ? products.map(serializeProduct) : [];
}

export function serializeOrderItem(item) {
  if (!item) return null;
  const product = item.product;
  return {
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    price: round2(item.price),
    total: round2(item.total),
    name: product?.name ?? "Removed product",
    slug: product?.slug ?? null,
    image: primaryImage(product?.images),
    sku: product?.sku ?? null,
    categoryName: product?.category?.name ?? null,
    brandName: product?.brand?.name ?? null,
    sellerId: product?.sellerId ?? null,
    sellerName: product?.seller?.name ?? null,
  };
}

export function serializeOrder(order) {
  if (!order) return null;

  const items = Array.isArray(order.items) ? order.items.map(serializeOrderItem) : [];
  const itemCount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  return {
    ...order,
    subtotal: round2(order.subtotal),
    discount: round2(order.discount),
    shipping: round2(order.shipping),
    tax: round2(order.tax),
    total: round2(order.total),
    items,
    itemCount,
    events: Array.isArray(order.events) ? order.events : [],
    customer: order.user ?? null,
    seller: order.seller ?? null,
    // Drop the raw relations now that they are surfaced under stable names.
    user: undefined,
  };
}

export function serializeOrders(orders) {
  return Array.isArray(orders) ? orders.map(serializeOrder) : [];
}

export function serializeReview(review) {
  if (!review) return null;
  return {
    ...review,
    rating: Number(review.rating) || 0,
    authorName: review.user?.name || "Anonymous",
    authorId: review.user?.id ?? null,
    user: undefined,
  };
}

export function serializeWishlistItem(item) {
  if (!item) return null;
  const product = item.product;
  return {
    id: item.id,
    productId: item.productId,
    addedAt: item.createdAt,
    product: serializeProduct(product),
  };
}
