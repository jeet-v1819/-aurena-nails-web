/**
 * /api/reviews
 *
 * GET    — public. ?productId=... [&rating=&page=&limit=]
 *          Returns paginated reviews plus a 1-5 star histogram.
 * POST   — signed-in users. body: { productId, rating (1-5), comment? }
 *          One review per user per product; re-submitting updates it.
 * DELETE — the review author or an admin. ?id=...
 *
 * Previously missing: orderService.addReview()/getProductReviews() existed but
 * no route exposed them, so the product detail page could not show or submit
 * reviews.
 */
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAuth } from "@/lib/auth";
import { addReview, deleteReview, getProductReviews } from "@/services/orderService";
import { serializeReview } from "@/utils/serialize";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const productId = req.query?.productId;
      if (!productId) return res.status(400).json({ error: "productId is required." });

      const result = await getProductReviews(String(productId), {
        page: req.query?.page,
        limit: req.query?.limit,
        rating: req.query?.rating,
      });

      return res.status(200).json({
        reviews: result.reviews.map(serializeReview),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        distribution: result.distribution,
      });
    }

    // Everything below requires a session.
    const user = await requireAuth(req, res);

    if (req.method === "POST") {
      const { productId, rating, comment } = req.body || {};
      if (!productId) return res.status(400).json({ error: "productId is required." });
      if (rating === undefined || rating === null || rating === "") {
        return res.status(400).json({ error: "rating is required." });
      }

      const review = await addReview(user.id, String(productId), rating, comment);
      return res.status(201).json({ review: serializeReview(review), message: "Review saved." });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.body?.id;
      if (!id) return res.status(400).json({ error: "A review id is required." });

      await deleteReview(String(id), user);
      return res.status(200).json({ message: "Review deleted.", id: String(id) });
    }

    return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Review operation failed.");
  }
}
