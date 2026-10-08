/**
 * Lightweight search endpoint (services, gallery designs, videos) used by the
 * header search suggestions. The full results live on /search.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json({ ok: true, results: [] });

  try {
    const [services, images, videos] = await Promise.all([
      prisma.service.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { shortDescription: { contains: query, mode: "insensitive" } },
            { style: { contains: query, mode: "insensitive" } },
            { category: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        select: { id: true, name: true, slug: true, durationMinutes: true, images: { take: 1, select: { url: true } } },
        take: 4,
      }),
      prisma.galleryImage.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { tags: { has: query } },
            { category: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        select: { id: true, title: true, url: true },
        take: 4,
      }),
      prisma.video.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { tags: { has: query } },
            { category: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        select: { id: true, title: true, thumbnailUrl: true },
        take: 4,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      results: [
        ...services.map((service) => ({
          type: "service" as const,
          id: service.id,
          title: service.name,
          subtitle: `${service.durationMinutes} min`,
          href: `/services/${service.slug}`,
          image: service.images[0]?.url ?? null,
        })),
        ...images.map((image) => ({
          type: "gallery" as const,
          id: image.id,
          title: image.title,
          subtitle: "Gallery design",
          href: `/gallery/${image.id}`,
          image: image.url,
        })),
        ...videos.map((video) => ({
          type: "video" as const,
          id: video.id,
          title: video.title,
          subtitle: "Video",
          href: `/videos/${video.id}`,
          image: video.thumbnailUrl,
        })),
      ],
    });
  } catch (error) {
    console.error("[api/search] failed:", error);
    return NextResponse.json({ ok: false, error: "Search is unavailable right now." }, { status: 500 });
  }
}
