/**
 * /api/admin/products  — ADMIN only.
 *
 * GET    ?search=&category=&brand=&status=&seller=&page=&limit=  paginated list
 * GET    ?id=...                                                single product
 * POST   body {name,price,stock,sellerId,...}                   create
 * PUT    body {id,...}                                          update
 * PATCH  body {id, stock?} | {id, status?}                      quick stock/status edit
 * DELETE ?id=...                                                delete
 *
 * SECURITY FIX: no authentication before — anyone could create, edit or delete
 * any product in the catalogue.
 *
 * Other fixes:
 *   - Writes previously built the Prisma payload with `Number(undefined)` which
 *     silently persisted NaN/0; they now go through productService, which
 *     validates types, whitelists `status`, stores images/size/color as JSON
 *     strings (they are String columns) and keeps `discountPrice` in sync.
 *   - `const { id } = req.query || req.body` never fell through to the body.
 *   - Missing/invalid ids now return 400/404 instead of a Prisma error -> 500.
 *   - Added the seller filter the admin product screen needs.
 */
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed, ApiError } from "@/lib/apiError";
import { requireAdmin } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  createProduct,
  deleteProduct,
  getProductById,
  setProductStatus,
  updateProduct,
  updateProductStock,
} from "@/services/productService";
import { normalizePagination } from "@/utils/format";
import { searchOr } from "@/utils/query";
import { serializeProduct, serializeProducts } from "@/utils/serialize";

function buildWhere(query) {
  const where = {};

  if (query.search) {
    const or = searchOr(query.search, ["name", "sku", { path: ["brand", "name"] }]);
    if (or) where.OR = or;
  }
  if (query.category) where.categoryId = String(query.category);
  if (query.brand) where.brandId = String(query.brand);
  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.seller) where.sellerId = String(query.seller);
  if (query.inStock === "false") where.stock = { lte: 0 };
  if (query.inStock === "true") where.stock = { gt: 0 };

  return where;
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req, res);
    const query = req.query || {};

    if (req.method === "GET") {
      if (query.id) {
        const product = await getProductById(String(query.id));
        if (!product) throw ApiError.notFound("Product not found.");
        return res.status(200).json({ product: serializeProduct(product) });
      }

      const where = buildWhere(query);
      const { page, limit, skip } = normalizePagination(query.page, query.limit, { defaultLimit: 12 });

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: true,
            brand: true,
            seller: { select: { id: true, name: true, email: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);

      return res.status(200).json({
        products: serializeProducts(products),
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      if (!body.name) throw ApiError.badRequest("Product name is required.");
      if (body.price === undefined || body.price === null || body.price === "") {
        throw ApiError.badRequest("Product price is required.");
      }

      // Admins may assign the product to any seller; default to the first
      // active seller so the record always has a valid owner.
      let sellerId = body.sellerId ? String(body.sellerId) : null;
      if (!sellerId) {
        const fallback = await prisma.user.findFirst({
          where: { role: ROLES.SELLER, status: true },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        sellerId = fallback?.id;
      }
      if (!sellerId) {
        throw ApiError.badRequest("No seller exists to own this product. Create a seller account first.");
      }

      const product = await createProduct({ ...body, sellerId });
      return res.status(201).json({ product: serializeProduct(product), message: "Product created." });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || query.id || "");
      if (!id) throw ApiError.badRequest("A product id is required.");

      const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw ApiError.notFound("Product not found.");

      const { id: _ignored, ...rest } = req.body || {};
      const product = await updateProduct(id, rest);
      return res.status(200).json({ product: serializeProduct(product), message: "Product updated." });
    }

    if (req.method === "PATCH") {
      const id = String(req.body?.id || query.id || "");
      if (!id) throw ApiError.badRequest("A product id is required.");

      const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw ApiError.notFound("Product not found.");

      let product;
      if (req.body?.stock !== undefined) {
        product = await updateProductStock(id, req.body.stock);
      } else if (req.body?.status !== undefined) {
        product = await setProductStatus(id, req.body.status);
      } else {
        throw ApiError.badRequest("Provide either stock or status.");
      }

      return res.status(200).json({ product: serializeProduct(product), message: "Product updated." });
    }

    if (req.method === "DELETE") {
      const id = String(query.id || req.body?.id || "");
      if (!id) throw ApiError.badRequest("A product id is required.");

      await deleteProduct(id);
      return res.status(200).json({ message: "Product deleted.", id });
    }

    return methodNotAllowed(res, ["GET", "POST", "PUT", "PATCH", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Admin product operation failed.");
  }
}
