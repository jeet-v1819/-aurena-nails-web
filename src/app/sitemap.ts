import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";

/**
 * Dynamic sitemap: static pages plus every published service, design and video.
 * Falls back to the static routes if the database is unreachable.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/services`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/gallery`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/videos`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/booking`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/register`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const [services, designs, videos] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true, deletedAt: null },
        select: { slug: true, updatedAt: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.galleryImage.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.video.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
        take: 200,
      }),
    ]);

    return [
      ...staticRoutes,
      ...services.map((service) => ({
        url: `${base}/services/${service.slug}`,
        lastModified: service.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
      ...designs.map((design) => ({
        url: `${base}/gallery/${design.id}`,
        lastModified: design.createdAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...videos.map((video) => ({
        url: `${base}/videos/${video.id}`,
        lastModified: video.publishedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch (error) {
    // A broken sitemap should never make the site unavailable.
    console.error("[sitemap] falling back to static routes:", error);
    return staticRoutes;
  }
}
