/**
 * /api/categories
 *
 * GET          — public list (with product counts).
 * POST/PUT/DELETE — ADMIN only.
 *
 * Fixes: previously GET-only with no method guard (any verb returned the list)
 * and no authorization on writes because there were none.
 */
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAdmin } from "@/lib/auth";
import { getCategories } from "@/services/productService";
import { slugify } from "@/utils/format";

async function uniqueSlug(model, base, ignoreId) {
  const root = slugify(base) || "item";
  let candidate = root;
  for (let i = 2; i < 100; i += 1) {
    const existing = await model.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const categories = await getCategories();
      return res.status(200).json(categories);
    }

    if (req.method === "POST") {
      await requireAdmin(req, res);

      const name = String(req.body?.name || "").trim();
      if (!name) return res.status(400).json({ error: "Category name is required." });

      const category = await prisma.category.create({
        data: {
          name,
          slug: await uniqueSlug(prisma.category, req.body?.slug || name),
          description: req.body?.description ? String(req.body.description) : null,
          image: req.body?.image ? String(req.body.image) : null,
        },
      });
      return res.status(201).json(category);
    }

    if (req.method === "PUT") {
      await requireAdmin(req, res);

      const id = String(req.body?.id || req.query?.id || "");
      if (!id) return res.status(400).json({ error: "A category id is required." });

      const data = {};
      if (req.body?.name !== undefined) data.name = String(req.body.name).trim();
      if (req.body?.description !== undefined) data.description = req.body.description ? String(req.body.description) : null;
      if (req.body?.image !== undefined) data.image = req.body.image ? String(req.body.image) : null;
      if (req.body?.slug) data.slug = await uniqueSlug(prisma.category, req.body.slug, id);

      const category = await prisma.category.update({ where: { id }, data });
      return res.status(200).json(category);
    }

    if (req.method === "DELETE") {
      await requireAdmin(req, res);

      const id = String(req.query?.id || req.body?.id || "");
      if (!id) return res.status(400).json({ error: "A category id is required." });

      const category = await prisma.category.findUnique({ where: { id } });
      if (!category) return res.status(404).json({ error: "Category not found." });

      // Deleting a referenced category would raise P2003 and surface as a 500.
      // Report it as a conflict with an actionable message instead.
      if (req.query?.force !== "1" && req.body?.force !== true) {
        const products = await prisma.product.count({ where: { categoryId: id } });
        if (products > 0) {
          return res.status(409).json({
            error: `This category still has ${products} product${products === 1 ? "" : "s"}. Move or delete them first.`,
            details: { products },
          });
        }
      }

      await prisma.category.delete({ where: { id } });
      return res.status(200).json({ message: "Category deleted.", id });
    }

    return methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Failed to process categories.");
  }
}
