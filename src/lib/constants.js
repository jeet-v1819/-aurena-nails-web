/**
 * Shared domain constants.
 *
 * The Prisma schema stores statuses/roles as String columns rather than native
 * enums, because SQLite (local development) has no enum support and the schema
 * must run unchanged on PostgreSQL/Neon (production). These constants are the
 * single source of truth for the allowed values.
 */

export const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  SELLER: "SELLER",
  CUSTOMER: "CUSTOMER",
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ORDER_STATUS = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
});

export const ORDER_STATUS_VALUES = Object.freeze(Object.values(ORDER_STATUS));

/** Ordered lifecycle used to render the customer-facing tracking timeline. */
export const ORDER_STATUS_FLOW = Object.freeze([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
]);

export const ORDER_STATUS_LABELS = Object.freeze({
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
});

/** Statuses a customer may still cancel from. */
export const CANCELLABLE_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
]);

export const PAYMENT_STATUS = Object.freeze({
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
});

export const PAYMENT_STATUS_VALUES = Object.freeze(Object.values(PAYMENT_STATUS));

/**
 * No real payment gateway is configured. MOCK / COD are simulated locally;
 * CARD and UPI are accepted labels only and never touch a processor.
 */
export const PAYMENT_METHODS = Object.freeze(["MOCK", "COD", "CARD", "UPI"]);

export const PRODUCT_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  OUT_OF_STOCK: "OUT_OF_STOCK",
});

export const PRODUCT_STATUS_VALUES = Object.freeze(Object.values(PRODUCT_STATUS));

export const ADDRESS_TYPES = Object.freeze(["SHIPPING", "BILLING"]);

/** Commerce defaults — overridable via environment variables. */
function readNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const SHIPPING_FEE = readNumber("SHIPPING_FEE", 5.99);
export const TAX_RATE = readNumber("TAX_RATE", 0.1); // 10%
/** 0 disables free shipping. */
export const FREE_SHIPPING_THRESHOLD = readNumber("FREE_SHIPPING_THRESHOLD", 0);

/** Whitelisted sort fields for the public product listing API. */
export const PRODUCT_SORT_FIELDS = Object.freeze([
  "createdAt",
  "price",
  "name",
  "averageRating",
  "reviewCount",
  "views",
  "stock",
  "discount",
]);

/**
 * Seeded demo logins, shown as one-click buttons on /login.
 *
 * These are NOT a bypass: clicking one runs the real credentials provider
 * against the real database, so it only works if `npm run db:seed` has been run.
 * The password mirrors PASSWORD in prisma/seed.js and is already documented in
 * README.md, so nothing secret is added to the client bundle by listing it here.
 *
 * Set NEXT_PUBLIC_DEMO_ACCOUNTS=false in production to hide the panel entirely
 * (the login page reads that flag; it defaults to visible for local development).
 */
export const DEMO_PASSWORD = "Password123!";

export const DEMO_ACCOUNTS = Object.freeze([
  { label: "admin", email: "admin@shop.test", role: ROLES.ADMIN, password: DEMO_PASSWORD },
  { label: "seller", email: "seller@shop.test", role: ROLES.SELLER, password: DEMO_PASSWORD },
  { label: "customer", email: "customer@shop.test", role: ROLES.CUSTOMER, password: DEMO_PASSWORD },
]);

/** Whether the demo-login panel should render (client-safe flag). */
export const SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_DEMO_ACCOUNTS !== "false";

/**
 * Legal order-status transitions.
 *
 * Lives here rather than in orderService.js because it is pure data and BOTH
 * sides need it: the server enforces it in updateOrderStatus(), and the console
 * UIs use it to offer only legal choices in the status dropdown. Keeping one
 * copy means the UI can never drift from what the API will accept.
 *
 * Admins may bypass this map with force=true (e.g. to correct a bad import).
 */
export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: Object.freeze([ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.CONFIRMED]: Object.freeze([ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.PROCESSING]: Object.freeze([ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.SHIPPED]: Object.freeze([ORDER_STATUS.DELIVERED]),
  [ORDER_STATUS.DELIVERED]: Object.freeze([ORDER_STATUS.REFUNDED]),
  [ORDER_STATUS.CANCELLED]: Object.freeze([]),
  [ORDER_STATUS.REFUNDED]: Object.freeze([]),
});

/** Statuses a seller (as opposed to an admin) may set. REFUNDED is admin-only. */
export const SELLER_ALLOWED_STATUSES = Object.freeze([
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
]);

/**
 * Statuses selectable from `current` for a given role.
 * Mirrors the server-side checks in orderService.updateOrderStatus().
 */
export function allowedNextStatuses(current, { role = ROLES.CUSTOMER } = {}) {
  const isAdmin = role === ROLES.ADMIN;
  const next = ORDER_STATUS_TRANSITIONS[current] || [];
  if (!isAdmin) return next;
  // Admins may also jump straight to REFUNDED or force an unusual transition.
  return ORDER_STATUS_VALUES.filter((status) => status !== current);
}
