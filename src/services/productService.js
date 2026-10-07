/**
 * Product / catalogue business logic.
 *
 * Fixes applied here versus the previous implementation:
 *   - `mode: "insensitive"` was passed unconditionally; Prisma's SQLite
 *     connector rejects it ("Unknown arg `mode`"). Now routed through
 *     utils/query.js so the same code works on SQLite and PostgreSQL.
 *   - `data: { _increment: { views: 1 } }` is not valid Prisma. The correct
 *     form is `data: { views: { increment: 1 } }`.
 *   - `images` / `size` / `color` / `specifications` are String columns holding
 *     JSON; passing raw arrays/objects threw a validation error.
 *   - `...(size || color && {...})` was an operator-precedence bug that spread
 *     the string `size` into the payload.
 *   - Slugs are now guaranteed unique instead of colliding on the second
 *     "iPhone" and failing the @unique constraint.
 *   - `sortBy` is whitelisted so an arbitrary query param cannot trigger a
 *     Prisma validation error.
 */
import prisma from "@/lib/prisma";
import {
  PRODUCT_STATUS,
  PRODUCT_STATUS_VALUES,
  PRODUCT_SORT_FIELDS,
} from "@/lib/constants";
import {
  computeDiscountPrice,
  normalizePagination,
  round2,
  slugify,
  stringifyJson,
} from "@/utils/format";
import { icontains, safeOrderBy, searchOr, toNumberOrUndefined } from "@/utils/query";

const PRODUCT_INCLUDE = {
  category: true,
  brand: true,
  seller: { select: { id: true, name: true, email: true } },
};

/**
 * Build a Prisma `where` clause from the public filter query-string.
 * Shared by getProducts() and the /api/products route so both behave the same.
 */
export function buildProductWhere(filters = {}) {
  const {
    search,
    category,
    categorySlug,
    brand,
    brandSlug,
    minPrice,
    maxPrice,
    minRating,
    availability,
    status,
    sellerId,
    size,
    color,
  } = filters;

  const where = {};

  if (search) {
    const or = searchOr(search, ["name", "sku", "description", { path: ["brand", "name"] }, { path: ["category", "name"] }]);
    if (or) where.OR = or;
  }

  if (category) where.categoryId = category;
  if (categorySlug) where.category = { slug: categorySlug };
  if (brand) where.brandId = brand;
  if (brandSlug) where.brand = { slug: brandSlug };
  if (sellerId) where.sellerId = sellerId;

  const lo = toNumberOrUndefined(minPrice);
  const hi = toNumberOrUndefined(maxPrice);
  if (lo !== undefined || hi !== undefined) {
    where.price = {};
    if (lo !== undefined) where.price.gte = lo;
    if (hi !== undefined) where.price.lte = hi;
  }

  const rating = toNumberOrUndefined(minRating);
  if (rating !== undefined) where.averageRating = { gte: rating };

  if (availability === "in-stock") {
    where.stock = { gt: 0 };
    where.status = PRODUCT_STATUS.ACTIVE;
  } else if (availability === "out-of-stock") {
    where.stock = 0;
  } else if (status && PRODUCT_STATUS_VALUES.includes(String(status).toUpperCase())) {
    where.status = String(status).toUpperCase();
  }

  // size/color are JSON arrays stored as String, so exact matching in SQL is
  // not portable across SQLite/Postgres. Filter on the SQL side where possible
  // and let callers refine in memory via filterByVariant().
  if (size) where.size = { contains: String(size) };
  if (color) where.color = { contains: String(color) };

  return where;
}

/** Get products with filtering, searching, sorting and pagination. */
export async function getProducts(filters = {}) {
  const { page, limit, skip } = normalizePagination(filters.page, filters.limit, {
    defaultLimit: 12,
  });

  const where = buildProductWhere(filters);
  const orderBy = safeOrderBy(filters.sortBy, filters.sortOrder, PRODUCT_SORT_FIELDS, "createdAt");

  // Map the UI's sort labels onto real columns.
  const sortLabel = String(filters.sortBy || "").toLowerCase();
  let resolvedOrderBy = orderBy;
  if (sortLabel === "newest") resolvedOrderBy = { createdAt: "desc" };
  else if (sortLabel === "oldest") resolvedOrderBy = { createdAt: "asc" };
  else if (sortLabel === "price-asc" || sortLabel === "price_asc") resolvedOrderBy = { price: "asc" };
  else if (sortLabel === "price-desc" || sortLabel === "price_desc") resolvedOrderBy = { price: "desc" };
  else if (sortLabel === "rating") resolvedOrderBy = { averageRating: "desc" };
  else if (sortLabel === "popular") resolvedOrderBy = { views: "desc" };
  else if (sortLabel === "name" || sortLabel === "name-asc") resolvedOrderBy = { name: "asc" };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: resolvedOrderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total, page, limit, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 };
}

/** Get a single product by id (or slug), with reviews and counts. */
export async function getProductById(productId, { includeInactive = true } = {}) {
  const where = String(productId || "").startsWith("slug:")
    ? { slug: String(productId).slice(5) }
    : { id: String(productId) };

  return prisma.product.findFirst({
    where: includeInactive ? where : { ...where, status: PRODUCT_STATUS.ACTIVE },
    include: {
      category: true,
      brand: true,
      seller: { select: { id: true, name: true, email: true, createdAt: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
      _count: { select: { reviews: true, cartItems: true, wishlistItems: true, orderItems: true } },
    },
  });
}

/** Guarantee a unique slug for a product name. */
async function uniqueProductSlug(name, ignoreId) {
  const base = slugify(name) || "product";
  let candidate = base;
  for (let i = 2; i < 100; i += 1) {
    const existing = await prisma.product.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Normalise a product payload from an API request into Prisma `data`.
 * Accepts arrays or JSON strings for images/size/color/specifications.
 */
function normalizeProductData(input, { partial = false } = {}) {
  const data = {};

  const has = (key) => input[key] !== undefined && input[key] !== null && input[key] !== "";

  if (has("name")) data.name = String(input.name).trim();
  if (has("description")) data.description = String(input.description);
  if (has("sku")) data.sku = String(input.sku).trim() || null;

  if (has("price")) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error("Price must be a non-negative number."), { status: 400 });
    }
    data.price = round2(price);
  }

  if (has("discount")) {
    const discount = Number(input.discount);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      throw Object.assign(new Error("Discount must be between 0 and 100."), { status: 400 });
    }
    data.discount = round2(discount);
  }

  if (has("stock")) {
    const stock = Number.parseInt(input.stock, 10);
    if (!Number.isFinite(stock) || stock < 0) {
      throw Object.assign(new Error("Stock must be a non-negative integer."), { status: 400 });
    }
    data.stock = stock;
  }

  if (has("status")) {
    const status = String(input.status).toUpperCase();
    if (!PRODUCT_STATUS_VALUES.includes(status)) {
      throw Object.assign(new Error(`Invalid product status. Expected one of: ${PRODUCT_STATUS_VALUES.join(", ")}.`), {
        status: 400,
      });
    }
    data.status = status;
  }

  if (input.images !== undefined) data.images = stringifyJson(input.images, []);
  if (input.size !== undefined) data.size = stringifyJson(input.size, []);
  if (input.color !== undefined) data.color = stringifyJson(input.color, []);
  if (input.specifications !== undefined) data.specifications = stringifyJson(input.specifications, {});

  if (has("categoryId")) data.categoryId = input.categoryId || null;
  if (has("brandId")) data.brandId = input.brandId || null;

  // Keep discountPrice consistent with price + discount on every write.
  if (data.price !== undefined || data.discount !== undefined) {
    const price = data.price !== undefined ? data.price : Number(input.price) || 0;
    const discount = data.discount !== undefined ? data.discount : Number(input.discount) || 0;
    data.discountPrice = computeDiscountPrice(price, discount);
  }

  if (partial) {
    // Never write undefined over existing values.
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
  }

  return data;
}

/** Create a product owned by `sellerId`. */
export async function createProduct(productData) {
  if (!productData?.name) throw Object.assign(new Error("Product name is required."), { status: 400 });
  if (!productData?.sellerId) throw Object.assign(new Error("A seller is required."), { status: 400 });
  if (productData.price === undefined || productData.price === null || productData.price === "") {
    throw Object.assign(new Error("Product price is required."), { status: 400 });
  }

  const seller = await prisma.user.findFirst({ where: { id: productData.sellerId } });
  if (!seller) throw Object.assign(new Error("Seller not found."), { status: 404 });

  const data = normalizeProductData(productData);
  data.slug = productData.slug ? slugify(productData.slug) : await uniqueProductSlug(productData.name);
  data.sellerId = productData.sellerId;
  if (data.discountPrice === undefined) data.discountPrice = computeDiscountPrice(data.price ?? 0, data.discount ?? 0);
  if (data.status === undefined) data.status = PRODUCT_STATUS.ACTIVE;

  return prisma.product.create({ data, include: PRODUCT_INCLUDE });
}

/** Update a product. Ownership must already have been verified by the caller. */
export async function updateProduct(productId, productData) {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw Object.assign(new Error("Product not found."), { status: 404 });

  const data = normalizeProductData(productData, { partial: true });

  // Recompute discountPrice against the *resulting* values, not just the patch.
  const nextPrice = data.price !== undefined ? data.price : existing.price;
  const nextDiscount = data.discount !== undefined ? data.discount : existing.discount;
  if (data.price !== undefined || data.discount !== undefined) {
    data.discountPrice = computeDiscountPrice(nextPrice, nextDiscount);
  }

  if (productData.name && slugify(productData.name) !== existing.slug) {
    data.slug = await uniqueProductSlug(productData.name, productId);
  }

  // Keep status in sync with stock unless it was set explicitly.
  if (data.status === undefined && data.stock !== undefined) {
    data.status = data.stock > 0 ? PRODUCT_STATUS.ACTIVE : PRODUCT_STATUS.OUT_OF_STOCK;
  }

  return prisma.product.update({ where: { id: productId }, data, include: PRODUCT_INCLUDE });
}

/** Delete a product. Cascades to cart/wishlist/order items and reviews. */
export async function deleteProduct(productId) {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw Object.assign(new Error("Product not found."), { status: 404 });
  return prisma.product.delete({ where: { id: productId } });
}

/** Set absolute stock. */
export async function updateProductStock(productId, newStock) {
  const stock = Number.parseInt(newStock, 10);
  if (!Number.isFinite(stock) || stock < 0) {
    throw Object.assign(new Error("Stock must be a non-negative integer."), { status: 400 });
  }

  return prisma.product.update({
    where: { id: productId },
    data: {
      stock,
      status: stock > 0 ? PRODUCT_STATUS.ACTIVE : PRODUCT_STATUS.OUT_OF_STOCK,
    },
  });
}

/** Enable / disable a product without deleting it. */
export async function setProductStatus(productId, status) {
  const next = String(status || "").toUpperCase();
  if (!PRODUCT_STATUS_VALUES.includes(next)) {
    throw Object.assign(new Error(`Invalid status. Expected one of: ${PRODUCT_STATUS_VALUES.join(", ")}.`), {
      status: 400,
    });
  }
  return prisma.product.update({ where: { id: productId }, data: { status: next } });
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function getBrands() {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function getProductBySku(sku) {
  if (!sku) return null;
  return prisma.product.findUnique({ where: { sku: String(sku) }, include: PRODUCT_INCLUDE });
}

/** Increment the view counter (correct Prisma atomic-update syntax). */
export async function incrementProductView(productId) {
  return prisma.product.update({
    where: { id: productId },
    data: { views: { increment: 1 } },
  });
}

/** Featured / newest active products for the home page. */
export async function getFeaturedProducts(limit = 8) {
  return prisma.product.findMany({
    where: { status: PRODUCT_STATUS.ACTIVE, stock: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: Number(limit) || 8,
    include: PRODUCT_INCLUDE,
  });
}

/** Best-rated products. */
export async function getTopRatedProducts(limit = 8) {
  return prisma.product.findMany({
    where: { status: PRODUCT_STATUS.ACTIVE, reviewCount: { gt: 0 } },
    orderBy: [{ averageRating: "desc" }, { reviewCount: "desc" }],
    take: Number(limit) || 8,
    include: PRODUCT_INCLUDE,
  });
}

/**
 * Products related to a given one (same category first, then same brand).
 * Used by the product detail page.
 */
export async function getRelatedProducts(product, limit = 4) {
  if (!product) return [];
  const where = {
    id: { not: product.id },
    status: PRODUCT_STATUS.ACTIVE,
    OR: [
      ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
      ...(product.brandId ? [{ brandId: product.brandId }] : []),
      ...(product.sellerId ? [{ sellerId: product.sellerId }] : []),
    ],
  };
  if (!where.OR.length) delete where.OR;

  return prisma.product.findMany({ where, take: Number(limit) || 4, include: PRODUCT_INCLUDE, orderBy: { createdAt: "desc" } });
}
