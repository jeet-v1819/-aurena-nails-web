/**
 * Small formatting / parsing helpers shared by the API layer and the UI.
 *
 * Several schema columns store JSON inside a String (images, size, color,
 * specifications) so that one schema works on both SQLite and PostgreSQL.
 * These helpers make reading/writing them safe and consistent.
 */

/** Round to 2 decimals, avoiding floating point artefacts like 0.30000000004. */
export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Format a number as a currency string. Falls back gracefully on bad input. */
export function formatCurrency(value, currency = "USD") {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `$${safe.toFixed(2)}`;
  }
}

/** Format a Date / ISO string for display. Returns "" for missing values. */
export function formatDate(value, options) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", options || { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** Parse a JSON String column into an array. Never throws. */
export function parseJsonArray(raw, fallback = []) {
  if (Array.isArray(raw)) return raw;
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw !== "string") return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Parse a JSON String column into an object. Never throws. */
export function parseJsonObject(raw, fallback = {}) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || raw === "") return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Serialise a value for a JSON String column. */
export function stringifyJson(value, fallback) {
  if (value === null || value === undefined) return JSON.stringify(fallback);
  if (typeof value === "string") {
    // Already JSON? Validate before storing, otherwise wrap as a single entry.
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(Array.isArray(fallback) ? [value] : value);
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(fallback);
  }
}

/**
 * Normalise a product's image column into an array of URL strings.
 * Handles the JSON-string storage format and legacy comma-separated values.
 */
export function productImages(raw) {
  const parsed = parseJsonArray(raw, []);
  if (parsed.length) return parsed.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim());
  if (typeof raw === "string" && raw.trim() && !raw.trim().startsWith("[")) {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/** First usable image, or a local placeholder path. */
export function primaryImage(raw, placeholder = "/placeholder-product.svg") {
  const images = productImages(raw);
  return images.length ? images[0] : placeholder;
}

/** URL-safe slug from a product/category name. */
export function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Effective unit price honouring the stored discount.
 * `discount` is a percentage (0-100); `discountPrice` is the cached result.
 */
export function effectivePrice(product) {
  if (!product) return 0;
  const price = Number(product.price) || 0;
  const discount = Number(product.discount) || 0;
  if (discount > 0) {
    if (product.discountPrice !== null && product.discountPrice !== undefined) {
      return round2(product.discountPrice);
    }
    return round2(price * (1 - discount / 100));
  }
  return round2(price);
}

/** Derive discountPrice from price + discount percentage. */
export function computeDiscountPrice(price, discount) {
  const p = Number(price) || 0;
  const d = Number(discount) || 0;
  if (d <= 0) return round2(p);
  return round2(p * (1 - Math.min(d, 100) / 100));
}

/** Clamp + coerce a pagination pair into safe integers. */
export function normalizePagination(page, limit, { maxLimit = 100, defaultLimit = 12 } = {}) {
  let p = Number.parseInt(page, 10);
  if (!Number.isFinite(p) || p < 1) p = 1;

  let l = Number.parseInt(limit, 10);
  if (!Number.isFinite(l) || l < 1) l = defaultLimit;
  if (l > maxLimit) l = maxLimit;

  return { page: p, limit: l, skip: (p - 1) * l };
}

/** Standard paginated response envelope so every list API is predictable. */
export function paginate({ data, total, page, limit }, dataKey = "data") {
  return {
    [dataKey]: data,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

/** True for a non-empty, non-"undefined" query-string value. */
export function hasText(value) {
  if (value === null || value === undefined) return false;
  const s = String(value).trim();
  return s.length > 0 && s !== "undefined" && s !== "null";
}
