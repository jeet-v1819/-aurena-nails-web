/**
 * /api/products/[id]
 *
 * GET    — public product detail, including reviews and related products.
 *          Increments the view counter once per request.
 * PUT    — ADMIN only. Sellers must use /api/seller/products.
 * DELETE — ADMIN only.
 *
 * Previously missing entirely: the product detail page had no endpoint to call,
 * which is why src/app/product/[id]/page.js was left as a placeholder.
 */
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAdmin } from "@/lib/auth";
import {
  deleteProduct,
  getProductById,
  getRelatedProducts,
  incrementProductView,
  updateProduct,
} from "@/services/productService";
import { getProductReviews } from "@/services/orderService";
import { serializeProduct, serializeProducts, serializeReview } from "@/utils/serialize";

export default async function handler(req, res) {
  const { id, view } = req.query || {};

  try {
    if (!id) {
      return res.status(400).json({ error: "A product id is required." });
    }

    if (req.method === "GET") {
      // The route segment may be a product id (what every internal link uses) or
      // a slug (so /product/wireless-mouse also works and is link-safe if an id
      // is ever regenerated). getProductById uses findFirst, so a miss is null
      // rather than a thrown P2025 and the fallback is cheap.
      const product = (await getProductById(id)) || (await getProductById(`slug:${id}`));
      if (!product) return res.status(404).json({ error: "Product not found." });

      // Popularity tracking is opt-out via ?view=0 so admin/seller screens and
      // crawlers do not inflate the counter.
      if (view !== "0" && view !== "false") {
        await incrementProductView(product.id).catch(() => {
          /* counter failures must never break the page */
        });
      }

      const [reviews, related] = await Promise.all([
        getProductReviews(product.id, { page: 1, limit: 10 }),
        getRelatedProducts(product, 4),
      ]);

      return res.status(200).json({
        product: serializeProduct({ ...product, views: product.views + 1 }),
        reviews: reviews.reviews.map(serializeReview),
        reviewTotal: reviews.total,
        reviewDistribution: reviews.distribution,
        related: serializeProducts(related),
      });
    }

    if (req.method === "PUT") {
      await requireAdmin(req, res);
      const product = await updateProduct(String(id), req.body || {});
      return res.status(200).json({ product: serializeProduct(product) });
    }

    if (req.method === "DELETE") {
      await requireAdmin(req, res);
      await deleteProduct(String(id));
      return res.status(200).json({ message: "Product deleted.", id: String(id) });
    }

    return methodNotAllowed(res, ["GET", "PUT", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Failed to load product.");
  }
}
