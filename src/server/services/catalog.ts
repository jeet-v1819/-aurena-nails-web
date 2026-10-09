/**
 * Services & categories — the heart of the studio catalogue.
 *
 * Prices are informational only: Aurena Nails never sells online, so nothing in
 * this module touches payments, stock or fulfilment.
 */
import "server-only";
import { cache } from "react";
import type { CategoryType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { deleteMedia } from "@/lib/media/storage";
import { slugify } from "@/lib/format";
import { recordAudit } from "./audit";
import { AppError } from "@/lib/errors";
import type { ServiceInput } from "@/validators/admin";

/* -------------------------------------------------------------- DTO mapping */

type ServiceWithRelations = Prisma.ServiceGetPayload<{
  include: {
    category: true;
    images: true;
    videos: true;
    _count: { select: { reviews: true; appointments: true } };
  };
}>;

export type ServiceDTO = ReturnType<typeof toServiceDTO>;

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(number) ? number : null;
}

export function toServiceDTO(service: ServiceWithRelations) {
  const images = [...service.images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    shortDescription: service.shortDescription,
    description: service.description,
    category: { id: service.category.id, name: service.category.name, slug: service.category.slug },
    categoryId: service.categoryId,
    durationMinutes: service.durationMinutes,
    startingPrice: decimalToNumber(service.startingPrice),
    regularPrice: decimalToNumber(service.regularPrice),
    promoPrice: decimalToNumber(service.promoPrice),
    currency: service.currency,
    nailType: service.nailType,
    style: service.style,
    occasion: service.occasion,
    difficulty: service.difficulty,
    preparationInstructions: service.preparationInstructions,
    afterCareInstructions: service.afterCareInstructions,
    isActive: service.isActive,
    isFeatured: service.isFeatured,
    isAvailable: service.isAvailable,
    sortOrder: service.sortOrder,
    ratingAverage: decimalToNumber(service.ratingAverage) ?? 0,
    ratingCount: service.ratingCount,
    reviewCount: service._count.reviews,
    appointmentCount: service._count.appointments,
    viewCount: service.viewCount,
    images: images.map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt ?? service.name,
      width: image.width,
      height: image.height,
      isPrimary: image.isPrimary,
    })),
    primaryImage: images[0]?.url ?? null,
    videos: service.videos
      .filter((video) => video.isActive)
      .map((video) => ({
        id: video.id,
        title: video.title,
        url: video.url,
        thumbnailUrl: video.thumbnailUrl,
        durationSeconds: video.durationSeconds,
      })),
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
    deletedAt: service.deletedAt,
  };
}

const serviceInclude = {
  category: true,
  images: { orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }] },
  videos: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { reviews: true, appointments: true } },
} satisfies Prisma.ServiceInclude;

/* --------------------------------------------------------------- categories */

export async function listCategories(type: CategoryType, options: { activeOnly?: boolean } = {}) {
  return prisma.category.findMany({
    where: { type, ...(options.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { services: true, galleryImages: true, videos: true } } },
  });
}

/** Categories with counts, for the admin screen (all types). */
export async function listAllCategories() {
  return prisma.category.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { services: true, galleryImages: true, videos: true } } },
  });
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

async function uniqueCategorySlug(type: CategoryType, base: string, excludeId?: string) {
  const slug = base || "category";
  let candidate = slug;
  let counter = 1;
  for (;;) {
    const found = await prisma.category.findFirst({
      where: { type, slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!found) return candidate;
    counter += 1;
    candidate = `${slug}-${counter}`;
  }
}

export async function createCategory(
  adminId: string,
  input: {
    name: string;
    slug?: string;
    type: string;
    description?: string;
    imageUrl?: string;
    imagePublicId?: string;
    isActive: boolean;
    sortOrder: number;
  }
) {
  const type = input.type as CategoryType;
  const slug = await uniqueCategorySlug(type, input.slug || slugify(input.name));

  const category = await prisma.category.create({
    data: {
      name: input.name,
      slug,
      type,
      description: input.description ?? null,
      imageUrl: input.imageUrl || null,
      imagePublicId: input.imagePublicId || null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });

  await recordAudit({ actorId: adminId, action: "category.create", entity: "Category", entityId: category.id });
  return category;
}

export async function updateCategory(
  adminId: string,
  categoryId: string,
  input: {
    name: string;
    slug?: string;
    type: string;
    description?: string;
    imageUrl?: string;
    imagePublicId?: string;
    isActive: boolean;
    sortOrder: number;
  }
) {
  const type = input.type as CategoryType;
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      type: true,
      imagePublicId: true,
      _count: { select: { services: true, galleryImages: true, videos: true } },
    },
  });
  if (!existing) throw new AppError("Category not found.", "NOT_FOUND");
  const inUse = existing._count.services + existing._count.galleryImages + existing._count.videos;
  if (existing.type !== type && inUse > 0) {
    throw new AppError("A category in use cannot be moved to another catalogue type. Move its items first.", "CATEGORY_IN_USE");
  }
  const slug = await uniqueCategorySlug(type, input.slug || slugify(input.name), categoryId);

  const category = await prisma.category.update({
    where: { id: categoryId },
    data: {
      name: input.name,
      slug,
      type,
      description: input.description ?? null,
      imageUrl: input.imageUrl || null,
      imagePublicId: input.imagePublicId || null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });

  if (existing.imagePublicId && existing.imagePublicId !== (input.imagePublicId || null)) {
    await deleteMedia(existing.imagePublicId, "image");
  }

  await recordAudit({ actorId: adminId, action: "category.update", entity: "Category", entityId: categoryId });
  return category;
}

export async function deleteCategory(adminId: string, categoryId: string) {
  const counts = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      imagePublicId: true,
      _count: { select: { services: true, galleryImages: true, videos: true } },
    },
  });

  const inUse =
    (counts?._count.services ?? 0) + (counts?._count.galleryImages ?? 0) + (counts?._count.videos ?? 0);

  if (inUse > 0) {
    return {
      ok: false as const,
      error: `This category is still used by ${inUse} item${inUse === 1 ? "" : "s"}. Move them to another category first, or deactivate it instead.`,
    };
  }

  await prisma.category.delete({ where: { id: categoryId } });
  if (counts?.imagePublicId) await deleteMedia(counts.imagePublicId, "image");
  await recordAudit({ actorId: adminId, action: "category.delete", entity: "Category", entityId: categoryId });
  return { ok: true as const };
}

/* ----------------------------------------------------------------- services */

export type ServiceFilters = {
  search?: string;
  categorySlug?: string;
  categoryId?: string;
  style?: string;
  occasion?: string;
  nailType?: string;
  difficulty?: string;
  maxDurationMinutes?: number;
  featured?: boolean;
  availableOnly?: boolean;
  includeInactive?: boolean;
  sort?: "newest" | "price-asc" | "price-desc" | "rating" | "popular" | "duration-asc";
  page?: number;
  pageSize?: number;
  take?: number;
};

function serviceWhere(filters: ServiceFilters): Prisma.ServiceWhereInput {
  const search = filters.search?.trim();

  return {
    deletedAt: null,
    ...(filters.includeInactive ? {} : { isActive: true }),
    ...(filters.availableOnly ? { isAvailable: true } : {}),
    ...(filters.featured ? { isFeatured: true } : {}),
    category: { type: "SERVICE", ...(filters.categorySlug ? { slug: filters.categorySlug } : {}) },
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.style ? { style: filters.style } : {}),
    ...(filters.occasion ? { occasion: filters.occasion } : {}),
    ...(filters.nailType ? { nailType: filters.nailType } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
    ...(filters.maxDurationMinutes ? { durationMinutes: { lte: filters.maxDurationMinutes } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { shortDescription: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { style: { contains: search, mode: "insensitive" as const } },
            { occasion: { contains: search, mode: "insensitive" as const } },
            { nailType: { contains: search, mode: "insensitive" as const } },
            { category: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

function serviceOrderBy(sort: ServiceFilters["sort"]): Prisma.ServiceOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ startingPrice: "asc" }, { name: "asc" }];
    case "price-desc":
      return [{ startingPrice: "desc" }, { name: "asc" }];
    case "rating":
      return [{ ratingAverage: "desc" }, { ratingCount: "desc" }];
    case "popular":
      return [{ viewCount: "desc" }, { ratingAverage: "desc" }];
    case "duration-asc":
      return [{ durationMinutes: "asc" }];
    default:
      return [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }];
  }
}

export async function listServices(filters: ServiceFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.take ?? filters.pageSize ?? 12;

  const [rows, total] = await Promise.all([
    prisma.service.findMany({
      where: serviceWhere(filters),
      include: serviceInclude,
      orderBy: serviceOrderBy(filters.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.service.count({ where: serviceWhere(filters) }),
  ]);

  return {
    items: rows.map(toServiceDTO),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listFeaturedServices(take = 6) {
  const rows = await prisma.service.findMany({
    where: { isActive: true, deletedAt: null, category: { type: "SERVICE" } },
    include: serviceInclude,
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map(toServiceDTO);
}

export const getServiceBySlug = cache(async (slug: string) => {
  const service = await prisma.service.findFirst({
    where: { slug, isActive: true, deletedAt: null, category: { type: "SERVICE" } },
    include: serviceInclude,
  });
  if (!service) return null;

  // Popularity signal for the "popular services" report.
  prisma.service
    .update({ where: { id: service.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  return toServiceDTO(service);
});

export async function getServiceById(serviceId: string) {
  const service = await prisma.service.findUnique({ where: { id: serviceId }, include: serviceInclude });
  return service ? toServiceDTO(service) : null;
}

export async function getRelatedServices(service: ServiceDTO, take = 3) {
  const rows = await prisma.service.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      category: { type: "SERVICE" },
      id: { not: service.id },
      OR: [{ categoryId: service.categoryId }, { style: service.style ?? undefined }],
    },
    include: serviceInclude,
    orderBy: [{ isFeatured: "desc" }, { ratingAverage: "desc" }],
    take,
  });
  return rows.map(toServiceDTO);
}

/** Bookable services for the booking wizard (id + name + duration). */
export async function listBookableServices() {
  return prisma.service.findMany({
    where: { isActive: true, isAvailable: true, deletedAt: null, category: { type: "SERVICE" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      durationMinutes: true,
      startingPrice: true,
      currency: true,
      category: { select: { name: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
    },
  });
}

async function uniqueServiceSlug(base: string, excludeId?: string) {
  const slug = base || "service";
  let candidate = slug;
  let counter = 1;
  for (;;) {
    const found = await prisma.service.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!found) return candidate;
    counter += 1;
    candidate = `${slug}-${counter}`;
  }
}

function serviceDataFromInput(input: ServiceInput, slug: string): Prisma.ServiceUncheckedCreateInput {
  return {
    name: input.name,
    slug,
    shortDescription: input.shortDescription,
    description: input.description,
    categoryId: input.categoryId,
    durationMinutes: input.durationMinutes,
    startingPrice: input.startingPrice ?? null,
    regularPrice: input.regularPrice ?? null,
    promoPrice: input.promoPrice ?? null,
    currency: input.currency || "INR",
    nailType: input.nailType ?? null,
    style: input.style ?? null,
    occasion: input.occasion ?? null,
    difficulty: input.difficulty ?? null,
    preparationInstructions: input.preparationInstructions ?? null,
    afterCareInstructions: input.afterCareInstructions ?? null,
    isActive: input.isActive,
    isFeatured: input.isFeatured,
    isAvailable: input.isAvailable,
    sortOrder: input.sortOrder,
  };
}

async function requireServiceCategory(categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, type: "SERVICE" },
    select: { id: true },
  });
  if (!category) throw new AppError("Choose a valid service category.", "VALIDATION");
}

export async function createService(adminId: string, input: ServiceInput) {
  await requireServiceCategory(input.categoryId);
  const slug = await uniqueServiceSlug(input.slug || slugify(input.name));
  const service = await prisma.service.create({ data: serviceDataFromInput(input, slug) });
  await recordAudit({ actorId: adminId, action: "service.create", entity: "Service", entityId: service.id });
  return service;
}

export async function updateService(adminId: string, serviceId: string, input: ServiceInput) {
  await requireServiceCategory(input.categoryId);
  const slug = await uniqueServiceSlug(input.slug || slugify(input.name), serviceId);
  const { id, ...data } = serviceDataFromInput(input, slug);
  // The id is generated by the database; it is destructured away so it is never
  // passed back into `update`.
  void id;
  const service = await prisma.service.update({ where: { id: serviceId }, data });
  await recordAudit({ actorId: adminId, action: "service.update", entity: "Service", entityId: serviceId });
  return service;
}

export async function setServiceFlags(
  adminId: string,
  serviceId: string,
  flags: { isActive?: boolean; isFeatured?: boolean; isAvailable?: boolean }
) {
  const service = await prisma.service.update({ where: { id: serviceId }, data: flags });
  await recordAudit({
    actorId: adminId,
    action: "service.flags",
    entity: "Service",
    entityId: serviceId,
    changes: flags,
  });
  return service;
}

/**
 * Services with appointment history are archived (soft delete) so the studio
 * keeps its records; unused ones are removed outright.
 */
export async function deleteService(adminId: string, serviceId: string) {
  const appointments = await prisma.appointment.count({ where: { serviceId } });

  if (appointments > 0) {
    await prisma.service.update({
      where: { id: serviceId },
      data: { deletedAt: new Date(), isActive: false, isAvailable: false, isFeatured: false },
    });
    await recordAudit({ actorId: adminId, action: "service.archive", entity: "Service", entityId: serviceId });
    return {
      ok: true as const,
      archived: true,
      message: `This service has ${appointments} appointment(s), so it was archived instead of deleted.`,
    };
  }

  const media = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      images: { select: { publicId: true } },
      videos: { select: { publicId: true, thumbnailPublicId: true } },
    },
  });

  await prisma.service.delete({ where: { id: serviceId } });
  await Promise.all([
    ...(media?.images.map((image) => deleteMedia(image.publicId, "image")) ?? []),
    ...(media?.videos.flatMap((video) => [deleteMedia(video.publicId, "video"), deleteMedia(video.thumbnailPublicId, "image")]) ?? []),
  ]);
  await recordAudit({ actorId: adminId, action: "service.delete", entity: "Service", entityId: serviceId });
  return { ok: true as const, archived: false, message: "Service deleted." };
}

/* ---------------------------------------------------------- service media */

export async function addServiceImage(
  adminId: string,
  serviceId: string,
  image: { url: string; publicId?: string; alt?: string; width?: number; height?: number; fileSize?: number; fileType?: string }
) {
  const existing = await prisma.serviceImage.count({ where: { serviceId } });

  const created = await prisma.serviceImage.create({
    data: {
      serviceId,
      url: image.url,
      publicId: image.publicId ?? null,
      alt: image.alt ?? null,
      width: image.width ?? null,
      height: image.height ?? null,
      fileSize: image.fileSize ?? null,
      fileType: image.fileType ?? null,
      isPrimary: existing === 0,
      sortOrder: existing,
    },
  });

  await recordAudit({ actorId: adminId, action: "service.image.add", entity: "ServiceImage", entityId: created.id });
  return created;
}

export async function setPrimaryServiceImage(adminId: string, serviceId: string, imageId: string) {
  await prisma.$transaction([
    prisma.serviceImage.updateMany({ where: { serviceId }, data: { isPrimary: false } }),
    prisma.serviceImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]);
  await recordAudit({ actorId: adminId, action: "service.image.primary", entity: "ServiceImage", entityId: imageId });
}

export async function deleteServiceImage(adminId: string, imageId: string) {
  const image = await prisma.serviceImage.delete({ where: { id: imageId } });
  // Promote another image when the primary one was removed.
  if (image.isPrimary) {
    const next = await prisma.serviceImage.findFirst({
      where: { serviceId: image.serviceId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) await prisma.serviceImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  await recordAudit({ actorId: adminId, action: "service.image.delete", entity: "ServiceImage", entityId: imageId });
  return image;
}

export async function addServiceVideo(
  adminId: string,
  serviceId: string,
  video: {
    title: string;
    url: string;
    publicId?: string;
    thumbnailUrl?: string;
    thumbnailPublicId?: string;
    durationSeconds?: number | null;
    width?: number | null;
    height?: number | null;
    fileSize?: number | null;
    format?: string | null;
  }
) {
  const existing = await prisma.serviceVideo.count({ where: { serviceId } });
  const created = await prisma.serviceVideo.create({
    data: {
      serviceId,
      title: video.title,
      url: video.url,
      publicId: video.publicId ?? null,
      thumbnailUrl: video.thumbnailUrl ?? null,
      thumbnailPublicId: video.thumbnailPublicId ?? null,
      durationSeconds: video.durationSeconds ?? null,
      width: video.width ?? null,
      height: video.height ?? null,
      fileSize: video.fileSize ?? null,
      format: video.format ?? null,
      sortOrder: existing,
    },
  });
  await recordAudit({ actorId: adminId, action: "service.video.add", entity: "ServiceVideo", entityId: created.id });
  return created;
}

export async function deleteServiceVideo(adminId: string, videoId: string) {
  const video = await prisma.serviceVideo.delete({ where: { id: videoId } });
  await recordAudit({ actorId: adminId, action: "service.video.delete", entity: "ServiceVideo", entityId: videoId });
  return video;
}

export async function countServices() {
  const [total, active, featured] = await Promise.all([
    prisma.service.count({ where: { deletedAt: null } }),
    prisma.service.count({ where: { deletedAt: null, isActive: true } }),
    prisma.service.count({ where: { deletedAt: null, isFeatured: true } }),
  ]);
  return { total, active, featured };
}

/** Distinct facet values actually present in the catalogue (for filter chips). */
export const getServiceFacets = cache(async () => {
  const rows = await prisma.service.findMany({
    where: { isActive: true, deletedAt: null },
    select: { style: true, occasion: true, nailType: true, difficulty: true, durationMinutes: true },
  });

  const collect = (key: "style" | "occasion" | "nailType" | "difficulty") =>
    Array.from(new Set(rows.map((row) => row[key]).filter((value): value is string => Boolean(value)))).sort();

  return {
    styles: collect("style"),
    occasions: collect("occasion"),
    nailTypes: collect("nailType"),
    difficulties: collect("difficulty"),
    maxDuration: rows.reduce((max, row) => Math.max(max, row.durationMinutes), 0),
  };
});
