/**
 * Nail-art gallery (photos) — browsing, filtering, moderation and uploads.
 */
import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { deleteMedia } from "@/lib/media/storage";
import { recordAudit } from "./audit";

export type GalleryFilters = {
  search?: string;
  categorySlug?: string;
  categoryId?: string;
  style?: string;
  occasion?: string;
  tag?: string;
  featured?: boolean;
  includeInactive?: boolean;
  sort?: "newest" | "oldest" | "popular" | "featured";
  page?: number;
  pageSize?: number;
  take?: number;
};

export type GalleryImageDTO = Awaited<ReturnType<typeof toGalleryDTO>>;

function toGalleryDTO(image: {
  id: string;
  title: string;
  description: string | null;
  url: string;
  publicId: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  format: string | null;
  tags: string[];
  style: string | null;
  occasion: string | null;
  designDate: Date | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  category: { id: string; name: string; slug: string };
}) {
  return {
    id: image.id,
    title: image.title,
    description: image.description,
    url: image.url,
    publicId: image.publicId,
    alt: image.alt ?? image.title,
    width: image.width,
    height: image.height,
    fileSize: image.fileSize,
    format: image.format,
    tags: image.tags ?? [],
    style: image.style,
    occasion: image.occasion,
    designDate: image.designDate,
    isFeatured: image.isFeatured,
    isActive: image.isActive,
    sortOrder: image.sortOrder,
    createdAt: image.createdAt,
    category: image.category,
  };
}

function galleryWhere(filters: GalleryFilters): Prisma.GalleryImageWhereInput {
  const search = filters.search?.trim();

  return {
    deletedAt: null,
    ...(filters.includeInactive ? {} : { isActive: true }),
    ...(filters.featured ? { isFeatured: true } : {}),
    ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.style ? { style: filters.style } : {}),
    ...(filters.occasion ? { occasion: filters.occasion } : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { alt: { contains: search, mode: "insensitive" as const } },
            { tags: { has: search } },
            { style: { contains: search, mode: "insensitive" as const } },
            { occasion: { contains: search, mode: "insensitive" as const } },
            { category: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

function galleryOrderBy(sort: GalleryFilters["sort"]): Prisma.GalleryImageOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "popular":
      return [{ wishlistItems: { _count: "desc" } }, { createdAt: "desc" }];
    case "featured":
      return [{ isFeatured: "desc" }, { sortOrder: "asc" }];
    default:
      return [{ isFeatured: "desc" }, { createdAt: "desc" }];
  }
}

export async function listGalleryImages(filters: GalleryFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.take ?? filters.pageSize ?? 12;

  const [rows, total] = await Promise.all([
    prisma.galleryImage.findMany({
      where: galleryWhere(filters),
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: galleryOrderBy(filters.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.galleryImage.count({ where: galleryWhere(filters) }),
  ]);

  return {
    items: rows.map(toGalleryDTO),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export const getGalleryImageById = cache(async (id: string) => {
  const image = await prisma.galleryImage.findFirst({
    where: { id, deletedAt: null },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  return image ? toGalleryDTO(image) : null;
});

export async function getRelatedGalleryImages(imageId: string, categoryId: string, take = 4) {
  const rows = await prisma.galleryImage.findMany({
    where: { id: { not: imageId }, categoryId, isActive: true, deletedAt: null },
    include: { category: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toGalleryDTO);
}

/** Every tag in use, with how many designs carry it (for the filter UI). */
export const getGalleryTags = cache(async () => {
  const rows = await prisma.galleryImage.findMany({
    where: { isActive: true, deletedAt: null },
    select: { tags: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of row.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
});

export async function countGalleryImages() {
  const [total, active, featured] = await Promise.all([
    prisma.galleryImage.count({ where: { deletedAt: null } }),
    prisma.galleryImage.count({ where: { deletedAt: null, isActive: true } }),
    prisma.galleryImage.count({ where: { deletedAt: null, isFeatured: true } }),
  ]);
  return { total, active, featured };
}

/* --------------------------------------------------------------- mutations */

export type GalleryInput = {
  title: string;
  description?: string;
  categoryId: string;
  url: string;
  publicId?: string;
  alt?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  format?: string;
  tags: string[];
  style?: string;
  occasion?: string;
  designDate?: string;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
};

function toData(input: GalleryInput): Prisma.GalleryImageUncheckedCreateInput {
  return {
    title: input.title,
    description: input.description ?? null,
    categoryId: input.categoryId,
    url: input.url,
    publicId: input.publicId || null,
    alt: input.alt || input.title,
    width: input.width ?? null,
    height: input.height ?? null,
    fileSize: input.fileSize ?? null,
    format: input.format || null,
    tags: input.tags,
    style: input.style ?? null,
    occasion: input.occasion ?? null,
    designDate: input.designDate ? new Date(`${input.designDate}T00:00:00.000Z`) : null,
    isFeatured: input.isFeatured,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
}

export async function createGalleryImage(adminId: string, input: GalleryInput) {
  const image = await prisma.galleryImage.create({ data: { ...toData(input), uploadedById: adminId } });
  await recordAudit({ actorId: adminId, action: "gallery.create", entity: "GalleryImage", entityId: image.id });
  return image;
}

/** Bulk upload: every file becomes a gallery entry in one transaction. */
export async function createGalleryImages(
  adminId: string,
  inputs: Array<GalleryInput & { fileName?: string }>,
  defaults: { categoryId: string; tags: string[]; style?: string; occasion?: string; isActive: boolean; isFeatured: boolean }
) {
  const created = await prisma.$transaction(
    inputs.map((input, index) =>
      prisma.galleryImage.create({
        data: {
          ...toData({
            ...input,
            categoryId: input.categoryId || defaults.categoryId,
            tags: input.tags.length ? input.tags : defaults.tags,
            style: input.style ?? defaults.style,
            occasion: input.occasion ?? defaults.occasion,
            isActive: input.isActive,
            isFeatured: input.isFeatured,
            sortOrder: defaults ? index : input.sortOrder,
          }),
          uploadedById: adminId,
        },
      })
    )
  );

  await recordAudit({
    actorId: adminId,
    action: "gallery.bulkCreate",
    entity: "GalleryImage",
    changes: { count: created.length },
  });

  return created;
}

export async function updateGalleryImage(adminId: string, imageId: string, input: GalleryInput) {
  const existing = await prisma.galleryImage.findUnique({ where: { id: imageId }, select: { publicId: true, url: true } });

  const image = await prisma.galleryImage.update({
    where: { id: imageId },
    data: toData(input),
  });

  // A replaced image leaves its old asset behind — clean it up.
  if (existing?.publicId && input.publicId && existing.publicId !== input.publicId) {
    await deleteMedia(existing.publicId, "image");
  }

  await recordAudit({ actorId: adminId, action: "gallery.update", entity: "GalleryImage", entityId: imageId });
  return image;
}

export async function setGalleryImageFlags(
  adminId: string,
  imageId: string,
  flags: { isActive?: boolean; isFeatured?: boolean }
) {
  const image = await prisma.galleryImage.update({ where: { id: imageId }, data: flags });
  await recordAudit({ actorId: adminId, action: "gallery.flags", entity: "GalleryImage", entityId: imageId, changes: flags });
  return image;
}

/** Gallery entries referenced by a wishlist are archived, not destroyed. */
export async function deleteGalleryImage(adminId: string, imageId: string) {
  const image = await prisma.galleryImage.findUnique({
    where: { id: imageId },
    select: { publicId: true, _count: { select: { wishlistItems: true } } },
  });

  if (image && image._count.wishlistItems > 0) {
    await prisma.galleryImage.update({
      where: { id: imageId },
      data: { deletedAt: new Date(), isActive: false, isFeatured: false },
    });
    await recordAudit({ actorId: adminId, action: "gallery.archive", entity: "GalleryImage", entityId: imageId });
    return { archived: true, message: "Saved by customers in wishlists — the design was archived instead of deleted." };
  }

  await prisma.galleryImage.delete({ where: { id: imageId } });
  if (image?.publicId) await deleteMedia(image.publicId, "image");
  await recordAudit({ actorId: adminId, action: "gallery.delete", entity: "GalleryImage", entityId: imageId });
  return { archived: false, message: "Design deleted." };
}
