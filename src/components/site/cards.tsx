import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarCheck, Clock, PlayCircle, Sparkles } from "lucide-react";
import { Badge, StarRating } from "@/components/ui/primitives";
import { SaveToWishlist } from "@/components/site/save-to-wishlist";
import { formatDuration, formatSeconds, formatStartingPrice } from "@/lib/format";
import type { ServiceDTO } from "@/server/services/catalog";
import type { GalleryImageDTO } from "@/server/services/gallery";
import type { VideoDTO } from "@/server/services/videos";

/* ---------------------------------------------------------- service card */

export function ServiceCard({
  service,
  saved = false,
  isAuthenticated = false,
}: {
  service: ServiceDTO;
  saved?: boolean;
  isAuthenticated?: boolean;
}) {
  const price = formatStartingPrice(service.startingPrice, service.currency);

  return (
    <article className="card group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-nude">
        {service.primaryImage ? (
          <Image
            src={service.primaryImage}
            alt={`${service.name} nail art`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-nude-dark">
            <Sparkles size={28} />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {service.isFeatured ? <Badge tone="gold">Featured</Badge> : null}
          {!service.isAvailable ? <Badge tone="danger">Unavailable</Badge> : null}
        </div>
        <div className="absolute right-3 top-3">
          <SaveToWishlist
            kind="service"
            id={service.id}
            initialSaved={saved}
            isAuthenticated={isAuthenticated}
            label={service.name}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[0.68rem] uppercase tracking-[0.2em] text-rosegold">{service.category.name}</p>
        <h3 className="mt-2 font-display text-xl leading-snug">{service.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{service.shortDescription}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} className="text-rosegold" />
            {formatDuration(service.durationMinutes)}
          </span>
          {price ? <span className="font-medium text-charcoal-soft">{price}</span> : null}
        </div>

        <div className="mt-3">
          <StarRating value={service.ratingAverage} count={service.ratingCount} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2 pt-1">
          <Link href={`/services/${service.slug}`} className="btn-outline btn-sm">
            View details
          </Link>
          {service.isAvailable ? (
            <Link href={`/booking?service=${service.slug}`} className="btn-primary btn-sm">
              <CalendarCheck size={14} />
              Book
            </Link>
          ) : (
            <Link href="/contact" className="btn-rose btn-sm">
              Enquire
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------- gallery card */

export function GalleryCard({
  image,
  saved = false,
  isAuthenticated = false,
  onOpen,
}: {
  image: GalleryImageDTO;
  saved?: boolean;
  isAuthenticated?: boolean;
  /** When provided, the card opens the lightbox instead of navigating. */
  onOpen?: (id: string) => void;
}) {
  const content = (
    <>
      <div className="relative w-full overflow-hidden rounded-xl bg-nude" style={{ aspectRatio: ratio(image) }}>
        <Image
          src={image.url}
          alt={image.alt ?? image.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/75 to-transparent p-3 pt-8 opacity-0 transition duration-300 group-hover:opacity-100">
          <p className="font-display text-sm text-white">{image.title}</p>
          <p className="text-[0.7rem] text-white/80">{image.category.name}</p>
        </div>
      </div>
    </>
  );

  return (
    <figure className="group relative">
      {onOpen ? (
        <button type="button" onClick={() => onOpen(image.id)} className="w-full text-left" aria-label={`View ${image.title}`}>
          {content}
        </button>
      ) : (
        <Link href={`/gallery/${image.id}`} aria-label={`View ${image.title}`}>
          {content}
        </Link>
      )}

      <figcaption className="mt-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{image.title}</p>
          <p className="text-xs text-muted">{image.category.name}</p>
        </div>
        <SaveToWishlist
          kind="gallery"
          id={image.id}
          initialSaved={saved}
          isAuthenticated={isAuthenticated}
          label={image.title}
          className="mt-0.5"
        />
      </figcaption>
    </figure>
  );
}

function ratio(image: GalleryImageDTO) {
  if (image.width && image.height) {
    return `${image.width} / ${image.height}`;
  }
  return "3 / 4";
}

/* ------------------------------------------------------------ video card */

export function VideoCard({ video }: { video: VideoDTO }) {
  return (
    <article className="card group overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]">
      <Link href={`/videos/${video.id}`} className="block">
        <div className="relative aspect-video overflow-hidden bg-charcoal">
          {video.thumbnailUrl ? (
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/40">
              <PlayCircle size={36} />
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/85 text-rosegold shadow-lg transition group-hover:scale-110">
              <PlayCircle size={30} />
            </span>
          </div>

          {video.durationSeconds ? (
            <span className="absolute bottom-3 right-3 rounded-full bg-charcoal/80 px-2.5 py-1 text-[0.7rem] text-white">
              {formatSeconds(video.durationSeconds)}
            </span>
          ) : null}
          {video.isFeatured ? (
            <span className="absolute left-3 top-3">
              <Badge tone="gold">Featured</Badge>
            </span>
          ) : null}
        </div>
      </Link>

      <div className="p-5">
        <p className="text-[0.68rem] uppercase tracking-[0.2em] text-rosegold">{video.category.name}</p>
        <h3 className="mt-2 font-display text-lg leading-snug">
          <Link href={`/videos/${video.id}`}>{video.title}</Link>
        </h3>
        {video.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted">{video.description}</p>
        ) : null}
        <Link href={`/videos/${video.id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-rosegold-dark">
          Watch video <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
