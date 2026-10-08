import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, PlayCircle, Search, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getSavedState } from "@/server/services/wishlist";
import { searchEverything } from "@/server/services/search";
import { SaveToWishlist } from "@/components/site/save-to-wishlist";
import { EmptyState, StarRating } from "@/components/ui/primitives";
import { formatDuration } from "@/lib/format";

export const metadata: Metadata = {
  title: "Search",
  description: "Search Aurena Nails services, nail-art designs and studio videos.",
  robots: { index: false, follow: true },
};

type SearchParams = Promise<{ q?: string | string[] }>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";

  const [results, user] = await Promise.all([searchEverything(query), getCurrentUser()]);
  const saved = await getSavedState(user?.id ?? null);

  return (
    <section className="section pt-12">
      <div className="container-page">
        <p className="eyebrow">Search</p>
        <h1 className="mt-3 text-3xl md:text-4xl">{query ? <>Results for “{query}”</> : "Search the studio"}</h1>

        {query ? (
          <p className="mt-3 text-sm text-muted">
            {results.total} result{results.total === 1 ? "" : "s"} across services, designs and videos.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Use the search box in the header, or browse the services and gallery with their filters.
          </p>
        )}

        {!query ? (
          <div className="mt-10">
            <EmptyState
              icon={<Search size={26} />}
              title="What are you looking for?"
              description="Try “bridal”, “chrome”, “French tips” or a service name — or browse the full menu."
              action={{ href: "/services", label: "Browse services" }}
            />
          </div>
        ) : results.total === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<Sparkles size={26} />}
              title="Nothing matched that search"
              description="Check the spelling, try a shorter word (for example “gel”), or browse the collections instead."
              action={{ href: "/gallery", label: "Browse the gallery" }}
            />
          </div>
        ) : (
          <div className="mt-12 space-y-16">
            {results.services.items.length ? (
              <section aria-labelledby="search-services">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <h2 id="search-services" className="text-2xl">
                    Services <span className="text-base text-muted">({results.services.total})</span>
                  </h2>
                  <Link
                    href={`/services?q=${encodeURIComponent(query)}`}
                    className="inline-flex items-center gap-1.5 text-sm text-rosegold-dark"
                  >
                    See all services <ArrowRight size={14} />
                  </Link>
                </div>

                <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.services.items.slice(0, 6).map((service) => (
                    <li key={service.id} className="card group flex gap-4 p-4">
                      <Link href={`/services/${service.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-nude">
                        {service.image ? (
                          <Image src={service.image} alt="" fill sizes="96px" className="object-cover" />
                        ) : (
                          <span className="absolute inset-0 grid place-items-center text-nude-dark">
                            <Sparkles size={20} />
                          </span>
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-rosegold">{service.categoryName}</p>
                        <h3 className="mt-1 font-display text-lg leading-snug">
                          <Link href={`/services/${service.slug}`}>{service.name}</Link>
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{service.shortDescription}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-muted">
                            <Clock size={12} /> {formatDuration(service.durationMinutes)}
                          </span>
                          <SaveToWishlist
                            kind="service"
                            id={service.id}
                            initialSaved={saved.serviceIds.has(service.id)}
                            isAuthenticated={Boolean(user)}
                            label={service.name}
                          />
                        </div>
                        {service.ratingCount > 0 ? (
                          <div className="mt-2">
                            <StarRating value={service.ratingAverage} count={service.ratingCount} size={12} />
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {results.gallery.items.length ? (
              <section aria-labelledby="search-designs">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <h2 id="search-designs" className="text-2xl">
                    Designs <span className="text-base text-muted">({results.gallery.total})</span>
                  </h2>
                  <Link
                    href={`/gallery?q=${encodeURIComponent(query)}`}
                    className="inline-flex items-center gap-1.5 text-sm text-rosegold-dark"
                  >
                    See all designs <ArrowRight size={14} />
                  </Link>
                </div>

                <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {results.gallery.items.slice(0, 8).map((image) => (
                    <li key={image.id}>
                      <Link href={`/gallery/${image.id}`} className="group block overflow-hidden rounded-2xl border border-line bg-nude">
                        <span className="relative block aspect-square">
                          <Image
                            src={image.url}
                            alt={image.title}
                            fill
                            sizes="(max-width: 640px) 50vw, 25vw"
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                        </span>
                      </Link>
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{image.title}</p>
                          <p className="text-xs text-muted">{image.categoryName}</p>
                        </div>
                        <SaveToWishlist
                          kind="gallery"
                          id={image.id}
                          initialSaved={saved.galleryIds.has(image.id)}
                          isAuthenticated={Boolean(user)}
                          label={image.title}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {results.videos.items.length ? (
              <section aria-labelledby="search-videos">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <h2 id="search-videos" className="text-2xl">
                    Videos <span className="text-base text-muted">({results.videos.total})</span>
                  </h2>
                  <Link
                    href={`/videos?q=${encodeURIComponent(query)}`}
                    className="inline-flex items-center gap-1.5 text-sm text-rosegold-dark"
                  >
                    See all videos <ArrowRight size={14} />
                  </Link>
                </div>

                <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.videos.items.slice(0, 6).map((video) => (
                    <li key={video.id}>
                      <Link href={`/videos/${video.id}`} className="card group flex gap-4 p-3">
                        <span className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-charcoal">
                          {video.thumbnailUrl ? (
                            <Image src={video.thumbnailUrl} alt="" fill sizes="112px" className="object-cover opacity-90" />
                          ) : null}
                          <span className="absolute inset-0 grid place-items-center text-white/85">
                            <PlayCircle size={24} />
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{video.title}</span>
                          <span className="mt-1 block text-xs text-muted">{video.categoryName}</span>
                          <span className="mt-1 block text-xs text-muted">
                            {video.viewCount.toLocaleString("en-IN")} views
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
