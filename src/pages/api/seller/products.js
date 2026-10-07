/**
 * /api/seller/products  — SELLER only (admins may also use it for support).
 *
 * GET    ?search=&category=&status=&page=&limit=   list YOUR products
 * GET    ?id=...                                   one of YOUR products
 * POST   body {name,price,stock,...}               create a product owned by you
 * PUT    body {id,...}                             update one of YOUR products
 * PATCH  body {id, stock?} | {id, status?}         quick stock / enable-disable edit
 * DELETE ?id=...                                   delete one of YOUR products
 *
 * SECURITY FIX: the previous implementation took `sellerId` straight from
 * `req.query` and returned 400 when it was missing. That meant ANY unauthenticated
 * caller could pass someone else's seller id and list, create, edit or delete
 * their products. Ownership is now derived exclusively from the verified
 * session, and every single-product operation re-checks `sellerId` before
 * writing — so a seller cannot touch another seller's catalogue by guessing ids.
 *
 * Other fixes: writes now go through productService (validation, JSON-encoded
 * images/size/color, unique slugs, discountPrice kept in sync, status
 * whitelisted) instead of hand-built payloads with `Number(undefined)`.
 */
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed, ApiError } from "@/lib/apiError";
import { requireSeller } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  createProduct,
  deleteProduct,
  setProductStatus,
  updateProduct,
  updateProductStock,
} from "@/services/productService";
import { normalizePagination } from "@/utils/format";
import { searchOr } from "@/utils/query";
import { serializeProduct, serializeProducts } from "@/utils/serialize";

/** Load a product and assert the caller owns it (admins bypass). */
async function loadOwnedProduct(id, user) {
  if (!id) throw ApiError.badRequest("A product id is required.");

  const product = await prisma.product.findUnique({
    where: { id: String(id) },
    include: { category: true, brand: true, seller: { select: { id: true, name: true } } },
  });

  if (!product) throw ApiError.notFound("Product not found.");

  if (user.role !== ROLES.ADMIN && String(product.sellerId) !== String(user.id)) {
    // 404 rather than 403 so we do not reveal that the product exists.
    throw ApiError.notFound("Product not found.");
  }

  return product;
}

export default async function handler(req, res) {
  try {
    const user = await requireSeller(req, res);
    const query = req.query || {};
    // Ownership is session-derived. `query.sellerId` is deliberately ignored.
    const sellerId = user.id;

    const where = { sellerId };
    if (query.search) {
      const or = searchOr(query.search, ["name", "sku"]);
      if (or) where.OR = or;
    }
    if (query.category) where.categoryId = String(query.category);
    if (query.brand) where.brandId = String(query.brand);
    if (query.status) where.status = String(query.status).toUpperCase();
    if (query.inStock === "false") where.stock = { lte: 0 };
    if (query.inStock === "true") where.stock = { gt: 0 };

    if (req.method === "GET") {
      if (query.id) {
        const product = await loadOwnedProduct(query.id, user);
        return res.status(200).json({ product: serializeProduct(product) });
      }

      const { page, limit, skip } = normalizePagination(query.page, query.limit, { defaultLimit: 12 });

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: true,
            brand: true,
            seller: { select: { id: true, name: true } },
            _count: { select: { orderItems: true, reviews: true } },
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

      const product = await createProduct({ ...body, sellerId });
      return res.status(201).json({ product: serializeProduct(product), message: "Product created." });
    }

    if (req.method === "PUT") {
      await loadOwnedProduct(req.body?.id || query.id, user);
      const { id: _ignored, sellerId: _ignoredSeller, ...rest } = req.body || {};
      const product = await updateProduct(String(req.body?.id || query.id), rest);
      return res.status(200).json({ product: serializeProduct(product), message: "Product updated." });
    }

    if (req.method === "PATCH") {
      const id = String(req.body?.id || query.id || "");
      await loadOwnedProduct(id, user);

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
      await loadOwnedProduct(id, user);
      await deleteProduct(id);
      return res.status(200).json({ message: "Product deleted.", id });
    }

    return methodNotAllowed(res, ["GET", "POST", "PUT", "PATCH", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Seller product operation failed.");
  }
}
