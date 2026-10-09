/**
 * Video gallery — nail-art videos with thumbnails, categories and tags.
 */
import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { deleteMedia } from "@/lib/media/storage";
import { recordAudit } from "./audit";
import { AppError } from "@/lib/errors";

export type VideoFilters = {
  search?: string;
  categorySlug?: string;
  categoryId?: string;
  tag?: string;
  featured?: boolean;
  includeInactive?: boolean;
  sort?: "newest" | "oldest" | "popular" | "featured";
  page?: number;
  pageSize?: number;
  take?: number;
};

function toVideoDTO(video: {
  id: string;
  title: string;
  description: string | null;
  url: string;
  publicId: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  format: string | null;
  tags: string[];
  isFeatured: boolean;
  isActive: boolean;
  viewCount: number;
  publishedAt: Date;
  createdAt: Date;
  category: { id: string; name: string; slug: string };
}) {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    url: video.url,
    publicId: video.publicId,
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    width: video.width,
    height: video.height,
    fileSize: video.fileSize,
    format: video.format,
    tags: video.tags ?? [],
    isFeatured: video.isFeatured,
    isActive: video.isActive,
    viewCount: video.viewCount,
    publishedAt: video.publishedAt,
    createdAt: video.createdAt,
    category: video.category,
  };
}

export type VideoDTO = ReturnType<typeof toVideoDTO>;

function videoWhere(filters: VideoFilters): Prisma.VideoWhereInput {
  const search = filters.search?.trim();

  return {
    deletedAt: null,
    ...(filters.includeInactive ? {} : { isActive: true }),
    ...(filters.featured ? { isFeatured: true } : {}),
    category: { type: "VIDEO", ...(filters.categorySlug ? { slug: filters.categorySlug } : {}) },
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { tags: { has: search } },
            { category: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

function videoOrderBy(sort: VideoFilters["sort"]): Prisma.VideoOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ publishedAt: "asc" }];
    case "popular":
      return [{ viewCount: "desc" }];
    case "featured":
      return [{ isFeatured: "desc" }, { publishedAt: "desc" }];
    default:
      return [{ isFeatured: "desc" }, { publishedAt: "desc" }];
  }
}

export async function listVideos(filters: VideoFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.take ?? filters.pageSize ?? 12;

  const [rows, total] = await Promise.all([
    prisma.video.findMany({
      where: videoWhere(filters),
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: videoOrderBy(filters.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.video.count({ where: videoWhere(filters) }),
  ]);

  return {
    items: rows.map(toVideoDTO),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export const getVideoById = cache(async (id: string) => {
  const video = await prisma.video.findFirst({
    where: { id, isActive: true, deletedAt: null, category: { type: "VIDEO" } },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  if (!video) return null;

  prisma.video.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
  return toVideoDTO(video);
});

export async function getRelatedVideos(videoId: string, categoryId: string, take = 4) {
  const rows = await prisma.video.findMany({
    where: { id: { not: videoId }, categoryId, isActive: true, deletedAt: null, category: { type: "VIDEO" } },
    include: { category: { select: { id: true, name: true, slug: true } } },
    orderBy: { publishedAt: "desc" },
    take,
  });
  return rows.map(toVideoDTO);
}

export async function countVideos() {
  const [total, active, featured] = await Promise.all([
    prisma.video.count({ where: { deletedAt: null } }),
    prisma.video.count({ where: { deletedAt: null, isActive: true } }),
    prisma.video.count({ where: { deletedAt: null, isFeatured: true } }),
  ]);
  return { total, active, featured };
}

/* --------------------------------------------------------------- mutations */

export type VideoInput = {
  title: string;
  description?: string;
  categoryId: string;
  url: string;
  publicId?: string;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fileSize?: number;
  format?: string;
  tags: string[];
  isFeatured: boolean;
  isActive: boolean;
};

function toData(input: VideoInput): Prisma.VideoUncheckedCreateInput {
  return {
    title: input.title,
    description: input.description ?? null,
    categoryId: input.categoryId,
    url: input.url,
    publicId: input.publicId || null,
    thumbnailUrl: input.thumbnailUrl || null,
    thumbnailPublicId: input.thumbnailPublicId || null,
    durationSeconds: input.durationSeconds ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    fileSize: input.fileSize ?? null,
    format: input.format || null,
    tags: input.tags,
    isFeatured: input.isFeatured,
    isActive: input.isActive,
  };
}

async function requireVideoCategory(categoryId: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, type: "VIDEO" }, select: { id: true } });
  if (!category) throw new AppError("Choose a valid video category.", "VALIDATION");
}

export async function createVideo(adminId: string, input: VideoInput) {
  await requireVideoCategory(input.categoryId);
  const video = await prisma.video.create({ data: toData(input) });
  await recordAudit({ actorId: adminId, action: "video.create", entity: "Video", entityId: video.id });
  return video;
}

export async function updateVideo(adminId: string, videoId: string, input: VideoInput) {
  await requireVideoCategory(input.categoryId);
  const existing = await prisma.video.findUnique({
    where: { id: videoId },
    select: { publicId: true, thumbnailPublicId: true },
  });
  const video = await prisma.video.update({ where: { id: videoId }, data: toData(input) });

  if (existing?.publicId && existing.publicId !== (input.publicId || null)) {
    await deleteMedia(existing.publicId, "video");
  }
  if (existing?.thumbnailPublicId && existing.thumbnailPublicId !== (input.thumbnailPublicId || null)) {
    await deleteMedia(existing.thumbnailPublicId, "image");
  }

  await recordAudit({ actorId: adminId, action: "video.update", entity: "Video", entityId: videoId });
  return video;
}

export async function setVideoFlags(
  adminId: string,
  videoId: string,
  flags: { isActive?: boolean; isFeatured?: boolean }
) {
  const video = await prisma.video.update({ where: { id: videoId }, data: flags });
  await recordAudit({ actorId: adminId, action: "video.flags", entity: "Video", entityId: videoId, changes: flags });
  return video;
}

export async function deleteVideo(adminId: string, videoId: string) {
  const video = await prisma.video.delete({ where: { id: videoId }, select: { publicId: true, thumbnailPublicId: true } });
  await deleteMedia(video.publicId, "video");
  await deleteMedia(video.thumbnailPublicId, "image");
  await recordAudit({ actorId: adminId, action: "video.delete", entity: "Video", entityId: videoId });
}
