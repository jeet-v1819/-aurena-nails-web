/**
 * Wishlist — saved services and nail-art designs.
 *
 * A wishlist is not a cart: nothing here can be purchased, priced or checked
 * out. It exists purely so a customer can keep the designs they love in one
 * place and jump straight to booking.
 */
import "server-only";
import { prisma } from "@/lib/db/prisma";

/** Every customer gets a wishlist; this creates it lazily if it is missing. */
export async function getOrCreateWishlist(userId: string) {
  const existing = await prisma.wishlist.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing;

  return prisma.wishlist.create({ data: { userId }, select: { id: true } });
}

export async function listWishlist(userId: string) {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              shortDescription: true,
              durationMinutes: true,
              startingPrice: true,
              currency: true,
              isActive: true,
              deletedAt: true,
              images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
              category: { select: { name: true, slug: true } },
            },
          },
          galleryImage: {
            select: {
              id: true,
              title: true,
              url: true,
              isActive: true,
              deletedAt: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  });

  if (!wishlist) return { items: [], services: 0, designs: 0 };

  const items = wishlist.items.filter((item) => {
    if (item.serviceId) return item.service && !item.service.deletedAt;
    return item.galleryImage && !item.galleryImage.deletedAt;
  });

  return {
    items,
    services: items.filter((item) => item.serviceId).length,
    designs: items.filter((item) => item.galleryImageId).length,
  };
}

export async function countWishlistItems(userId: string) {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    select: { _count: { select: { items: true } } },
  });
  return wishlist?._count.items ?? 0;
}

export type ToggleResult = { ok: true; saved: boolean } | { ok: false; error: string };

/** Adds/removes a service. Returns the new state so the UI can update. */
export async function toggleServiceWishlist(userId: string, serviceId: string): Promise<ToggleResult> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, deletedAt: null },
    select: { id: true },
  });
  if (!service) return { ok: false, error: "That service is no longer available." };

  const wishlist = await getOrCreateWishlist(userId);

  const existing = await prisma.wishlistItem.findFirst({
    where: { wishlistId: wishlist.id, serviceId },
    select: { id: true },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return { ok: true, saved: false };
  }

  await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, serviceId } });
  return { ok: true, saved: true };
}

export async function toggleGalleryWishlist(userId: string, galleryImageId: string): Promise<ToggleResult> {
  const image = await prisma.galleryImage.findFirst({
    where: { id: galleryImageId, deletedAt: null },
    select: { id: true },
  });
  if (!image) return { ok: false, error: "That design is no longer available." };

  const wishlist = await getOrCreateWishlist(userId);

  const existing = await prisma.wishlistItem.findFirst({
    where: { wishlistId: wishlist.id, galleryImageId },
    select: { id: true },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return { ok: true, saved: false };
  }

  await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, galleryImageId } });
  return { ok: true, saved: true };
}

export async function removeWishlistItem(userId: string, itemId: string) {
  const result = await prisma.wishlistItem.deleteMany({
    where: { id: itemId, wishlist: { userId } },
  });
  return result.count > 0;
}

/** Which of these services/designs are already saved (for heart icons). */
export async function getSavedState(userId: string | null) {
  if (!userId) return { serviceIds: new Set<string>(), galleryIds: new Set<string>() };

  const items = await prisma.wishlistItem.findMany({
    where: { wishlist: { userId } },
    select: { serviceId: true, galleryImageId: true },
  });

  return {
    serviceIds: new Set(items.map((item) => item.serviceId).filter((id): id is string => Boolean(id))),
    galleryIds: new Set(items.map((item) => item.galleryImageId).filter((id): id is string => Boolean(id))),
  };
}
