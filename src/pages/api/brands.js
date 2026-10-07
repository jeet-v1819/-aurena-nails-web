/**
 * /api/brands
 *
 * GET             — public list (with product counts).
 * POST/PUT/DELETE — ADMIN only.
 */
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAdmin } from "@/lib/auth";
import { getBrands } from "@/services/productService";
import { slugify } from "@/utils/format";

async function uniqueSlug(base, ignoreId) {
  const root = slugify(base) || "brand";
  let candidate = root;
  for (let i = 2; i < 100; i += 1) {
    const existing = await prisma.brand.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const brands = await getBrands();
      return res.status(200).json(brands);
    }

    if (req.method === "POST") {
      await requireAdmin(req, res);

      const name = String(req.body?.name || "").trim();
      if (!name) return res.status(400).json({ error: "Brand name is required." });

      const brand = await prisma.brand.create({
        data: {
          name,
          slug: await uniqueSlug(req.body?.slug || name),
          description: req.body?.description ? String(req.body.description) : null,
          image: req.body?.image ? String(req.body.image) : null,
        },
      });
      return res.status(201).json(brand);
    }

    if (req.method === "PUT") {
      await requireAdmin(req, res);

      const id = String(req.body?.id || req.query?.id || "");
      if (!id) return res.status(400).json({ error: "A brand id is required." });

      const data = {};
      if (req.body?.name !== undefined) data.name = String(req.body.name).trim();
      if (req.body?.description !== undefined) data.description = req.body.description ? String(req.body.description) : null;
      if (req.body?.image !== undefined) data.image = req.body.image ? String(req.body.image) : null;
      if (req.body?.slug) data.slug = await uniqueSlug(req.body.slug, id);

      const brand = await prisma.brand.update({ where: { id }, data });
      return res.status(200).json(brand);
    }

    if (req.method === "DELETE") {
      await requireAdmin(req, res);

      const id = String(req.query?.id || req.body?.id || "");
      if (!id) return res.status(400).json({ error: "A brand id is required." });

      const brand = await prisma.brand.findUnique({ where: { id } });
      if (!brand) return res.status(404).json({ error: "Brand not found." });

      // Same reasoning as /api/categories: turn a would-be P2003 into a 409.
      if (req.query?.force !== "1" && req.body?.force !== true) {
        const products = await prisma.product.count({ where: { brandId: id } });
        if (products > 0) {
          return res.status(409).json({
            error: `This brand still has ${products} product${products === 1 ? "" : "s"}. Move or delete them first.`,
            details: { products },
          });
        }
      }

      await prisma.brand.delete({ where: { id } });
      return res.status(200).json({ message: "Brand deleted.", id });
    }

    return methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Failed to process brands.");
  }
}
