/**
 * Global search across the public catalogue: services, gallery designs and
 * videos. Kept server-side so /search renders complete results (the header
 * suggestions use the lighter /api/search endpoint).
 */
import "server-only";
import { prisma } from "@/lib/db/prisma";

export type SearchGroup<T> = { total: number; items: T[] };

export type GlobalSearchResults = {
  query: string;
  services: SearchGroup<{
    id: string;
    name: string;
    slug: string;
    shortDescription: string;
    durationMinutes: number;
    image: string | null;
    categoryName: string;
    ratingAverage: number;
    ratingCount: number;
  }>;
  gallery: SearchGroup<{ id: string; title: string; url: string; categoryName: string; tags: string[] }>;
  videos: SearchGroup<{ id: string; title: string; thumbnailUrl: string | null; categoryName: string; viewCount: number }>;
  total: number;
};

export async function searchEverything(rawQuery: string, take = 12): Promise<GlobalSearchResults> {
  const query = rawQuery.trim();

  if (query.length < 2) {
    return {
      query,
      services: { total: 0, items: [] },
      gallery: { total: 0, items: [] },
      videos: { total: 0, items: [] },
      total: 0,
    };
  }

  const [services, serviceCount, gallery, galleryCount, videos, videoCount] = await Promise.all([
    prisma.service.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { shortDescription: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { style: { contains: query, mode: "insensitive" } },
          { occasion: { contains: query, mode: "insensitive" } },
          { nailType: { contains: query, mode: "insensitive" } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: [{ isFeatured: "desc" }, { ratingAverage: "desc" }],
      take,
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        durationMinutes: true,
        ratingAverage: true,
        ratingCount: true,
        category: { select: { name: true } },
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
      },
    }),
    prisma.service.count({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { shortDescription: { contains: query, mode: "insensitive" } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
    }),
    prisma.galleryImage.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { tags: { has: query } },
          { style: { contains: query, mode: "insensitive" } },
          { occasion: { contains: query, mode: "insensitive" } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take,
      select: { id: true, title: true, url: true, tags: true, category: { select: { name: true } } },
    }),
    prisma.galleryImage.count({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { tags: { has: query } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
    }),
    prisma.video.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { tags: { has: query } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      take,
      select: { id: true, title: true, thumbnailUrl: true, viewCount: true, category: { select: { name: true } } },
    }),
    prisma.video.count({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { tags: { has: query } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
    }),
  ]);

  return {
    query,
    services: {
      total: serviceCount,
      items: services.map((service) => ({
        id: service.id,
        name: service.name,
        slug: service.slug,
        shortDescription: service.shortDescription,
        durationMinutes: service.durationMinutes,
        image: service.images[0]?.url ?? null,
        categoryName: service.category.name,
        ratingAverage: Number(service.ratingAverage ?? 0),
        ratingCount: service.ratingCount,
      })),
    },
    gallery: {
      total: galleryCount,
      items: gallery.map((image) => ({
        id: image.id,
        title: image.title,
        url: image.url,
        categoryName: image.category.name,
        tags: image.tags,
      })),
    },
    videos: {
      total: videoCount,
      items: videos.map((video) => ({
        id: video.id,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        categoryName: video.category.name,
        viewCount: video.viewCount,
      })),
    },
    total: serviceCount + galleryCount + videoCount,
  };
}
