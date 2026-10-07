/**
 * /api/products
 *
 * GET  — public catalogue listing with search, filters, sorting, pagination.
 *        Query params: search, category, categorySlug, brand, brandSlug,
 *        minPrice, maxPrice, minRating, availability, status, size, color,
 *        sellerId, sortBy, sortOrder, page, limit
 *
 * POST — create a product. ADMIN only. Sellers must use /api/seller/products so
 *        that ownership is derived from their session, not from a request body.
 *
 * Fixes: the previous version passed `mode: "insensitive"` unconditionally
 * (rejected by Prisma's SQLite connector), accepted an arbitrary `sortBy`
 * column (Prisma validation error), ignored `sortOrder`, had no pagination
 * metadata and returned raw JSON-string columns that the UI could not read.
 */
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAdmin } from "@/lib/auth";
import { createProduct, getProducts } from "@/services/productService";
import { serializeProduct, serializeProducts } from "@/utils/serialize";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await getProducts(req.query || {});

      return res.status(200).json({
        products: serializeProducts(result.products),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    }

    if (req.method === "POST") {
      const admin = await requireAdmin(req, res);
      const product = await createProduct({ ...(req.body || {}), sellerId: req.body?.sellerId });
      return res.status(201).json({ product: serializeProduct(product), createdBy: admin.id });
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    return respondWithError(res, error, "Failed to fetch products.");
  }
}
