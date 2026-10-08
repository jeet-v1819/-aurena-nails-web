import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Heart, Sparkles, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listWishlist } from "@/server/services/wishlist";
import { EmptyState, Badge } from "@/components/ui/primitives";
import { WishlistRemoveButton } from "@/components/customer/wishlist-remove-button";
import { formatDuration, formatStartingPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "My Wishlist",
  robots: { index: false, follow: false },
};

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function WishlistPage() {
  const session = await requireUser("/wishlist");
  const wishlist = await listWishlist(session.id);

  if (!wishlist.items.length) {
    return (
      <EmptyState
        icon={<Heart size={26} />}
        title="Your wishlist is empty"
        description="Tap the heart on any service or gallery design to save it here — your artist can see your picks when you arrive."
        action={{ href: "/gallery", label: "Browse designs" }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {wishlist.services} service{wishlist.services === 1 ? "" : "s"} · {wishlist.designs} design
          {wishlist.designs === 1 ? "" : "s"} saved
        </p>
        <Link href="/booking" className="btn-primary btn-sm">
          <CalendarCheck size={15} /> Book an appointment
        </Link>
      </div>

      {/* ------------------------------------------------------ saved services */}
      {wishlist.services ? (
        <section aria-labelledby="wishlist-services">
          <h2 id="wishlist-services" className="text-xl">
            Saved services
          </h2>

          <ul className="mt-4 space-y-4">
            {wishlist.items
              .filter((item) => item.service)
              .map((item) => {
                const service = item.service!;
                const price = formatStartingPrice(decimalToNumber(service.startingPrice), service.currency);

                return (
                  <li key={item.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <Link
                      href={`/services/${service.slug}`}
                      className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl bg-nude sm:h-20 sm:w-20"
                    >
                      {service.images[0] ? (
                        <Image src={service.images[0].url} alt="" fill sizes="80px" className="object-cover" />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-nude-dark">
                          <Sparkles size={18} />
                        </span>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg">
                          <Link href={`/services/${service.slug}`} className="hover:text-rosegold-dark">
                            {service.name}
                          </Link>
                        </h3>
                        {!service.isActive ? <Badge tone="muted">Currently unavailable</Badge> : null}
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-muted">{service.shortDescription}</p>
                      <p className="mt-1 text-xs text-muted">
                        {service.category.name} · {formatDuration(service.durationMinutes)}
                        {price ? ` · ${price}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/booking?service=${service.slug}`} className="btn-outline btn-sm">
                        Book
                      </Link>
                      <WishlistRemoveButton itemId={item.id} label={service.name} />
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------------- saved designs */}
      {wishlist.designs ? (
        <section aria-labelledby="wishlist-designs">
          <h2 id="wishlist-designs" className="text-xl">
            Saved designs
          </h2>

          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {wishlist.items
              .filter((item) => item.galleryImage)
              .map((item) => {
                const design = item.galleryImage!;

                return (
                  <li key={item.id} className="card overflow-hidden">
                    <Link href={`/gallery/${design.id}`} className="relative block aspect-4/5 bg-nude">
                      <Image
                        src={design.url}
                        alt={design.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover"
                      />
                    </Link>
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg leading-snug">
                          <Link href={`/gallery/${design.id}`} className="hover:text-rosegold-dark">
                            {design.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-xs text-muted">{design.category.name}</p>
                      </div>
                      <WishlistRemoveButton itemId={item.id} label={design.title} />
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      <p className="rounded-2xl bg-cream-deep p-5 text-xs leading-relaxed text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-charcoal-soft">
          <Trash2 size={13} className="text-rosegold" /> Tip
        </span>{" "}
        Saving designs is a planning tool, not a purchase — nothing is reserved or charged. Mention your favourites when
        you arrive and your artist will match the look to your nails.
      </p>
    </div>
  );
}
