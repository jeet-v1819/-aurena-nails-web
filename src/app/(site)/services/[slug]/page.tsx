import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Heart,
  Sparkles,
  Timer,
  Wand2,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getServiceBySlug, getRelatedServices } from "@/server/services/catalog";
import { listGalleryImages } from "@/server/services/gallery";
import { listServiceReviews } from "@/server/services/reviews";
import { getSavedState } from "@/server/services/wishlist";
import { getSiteContent } from "@/server/services/content";
import { ServiceCard } from "@/components/site/cards";
import { SaveToWishlist } from "@/components/site/save-to-wishlist";
import { ServiceGallery } from "@/components/site/service-gallery";
import { FadeIn } from "@/components/site/motion";
import { ModalLauncher } from "@/components/ui/modal-launcher";
import { Badge, Divider, Pagination, SectionHeading, StarRating } from "@/components/ui/primitives";
import { formatDuration, formatStartingPrice, formatDate } from "@/lib/format";
import { parsePage } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);

  if (!service) return { title: "Service not found" };

  return {
    title: service.name,
    description: service.shortDescription,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: {
      title: service.name,
      description: service.shortDescription,
      images: service.primaryImage ? [{ url: service.primaryImage }] : undefined,
      type: "article",
    },
  };
}

export default async function ServiceDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const reviewPage = parsePage(Array.isArray(search.reviews) ? search.reviews[0] : search.reviews);

  const [user, content, related, reviews, relatedDesigns] = await Promise.all([
    getCurrentUser(),
    getSiteContent(),
    getRelatedServices(service, 3),
    listServiceReviews(service.id, { page: reviewPage, pageSize: 4 }),
    listGalleryImages({ categorySlug: service.category.slug, take: 6 }),
  ]);

  const saved = await getSavedState(user?.id ?? null);
  const price = formatStartingPrice(service.startingPrice, service.currency);

  // Structured data helps the service page win rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.shortDescription,
    serviceType: service.category.name,
    provider: { "@type": "BeautySalon", name: content.siteName, telephone: content.phone, address: content.address },
    ...(price ? { offers: { "@type": "Offer", price: service.startingPrice, priceCurrency: service.currency } } : {}),
    ...(service.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: service.ratingAverage,
            reviewCount: service.ratingCount,
          },
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="border-b border-line bg-cream">
        <div className="container-page py-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link href="/" className="hover:text-charcoal">
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <Link href="/services" className="hover:text-charcoal">
              Services
            </Link>
            <span aria-hidden="true"> / </span>
            <Link href={`/services?category=${service.category.slug}`} className="hover:text-charcoal">
              {service.category.name}
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-charcoal-soft">{service.name}</span>
          </nav>
        </div>
      </section>

      <section className="section pt-10">
        <div className="container-page grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <FadeIn>
            <ServiceGallery images={service.images} serviceName={service.name} videos={service.videos} />
          </FadeIn>

          <FadeIn delay={0.08}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="rose">{service.category.name}</Badge>
              {service.isFeatured ? <Badge tone="gold">Signature</Badge> : null}
              {!service.isAvailable ? <Badge tone="danger">Temporarily unavailable</Badge> : null}
            </div>

            <h1 className="mt-4 text-3xl md:text-4xl">{service.name}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <StarRating value={service.ratingAverage} count={service.ratingCount} />
              {service.appointmentCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <Heart size={13} className="text-rosegold" />
                  Booked {service.appointmentCount} time{service.appointmentCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            <p className="mt-5 text-sm leading-relaxed text-charcoal-soft md:text-base">{service.shortDescription}</p>

            <dl className="mt-7 grid gap-3 sm:grid-cols-3">
              <Meta icon={<Clock size={15} />} label="Duration" value={formatDuration(service.durationMinutes)} />
              {price ? <Meta icon={<Timer size={15} />} label="Starting price" value={price} /> : null}
              {service.difficulty ? (
                <Meta icon={<Wand2 size={15} />} label="Artistry level" value={service.difficulty} />
              ) : null}
            </dl>

            <p className="mt-3 text-[0.7rem] text-muted">
              Prices are indicative and confirmed by your artist during the appointment. Bookings are free — nothing is
              charged online.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {service.isAvailable ? (
                <Link href={`/booking?service=${service.slug}`} className="btn-primary btn-lg">
                  <CalendarCheck size={17} /> Book Appointment
                </Link>
              ) : (
                <Link href="/contact" className="btn-primary btn-lg">
                  Enquire about availability
                </Link>
              )}

              <SaveToWishlist
                kind="service"
                id={service.id}
                initialSaved={saved.serviceIds.has(service.id)}
                isAuthenticated={Boolean(user)}
                label={service.name}
                withText
                className="px-4 py-3"
              />
            </div>

            {(service.nailType || service.style || service.occasion) && (
              <dl className="mt-8 grid gap-2 text-sm">
                {service.nailType ? <Row label="Nail type" value={service.nailType} /> : null}
                {service.style ? <Row label="Style" value={service.style} /> : null}
                {service.occasion ? <Row label="Best for" value={service.occasion} /> : null}
              </dl>
            )}
          </FadeIn>
        </div>
      </section>

      {/* ------------------------------------------------------ description */}
      <section className="section pt-0">
        <div className="container-page grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="prose prose-sm max-w-none">
              <h2 className="text-2xl">About this service</h2>
              {service.description.split("\n").map((paragraph, index) =>
                paragraph.trim() ? (
                  <p key={index} className="mt-4 text-sm leading-relaxed text-muted">
                    {paragraph}
                  </p>
                ) : null
              )}
            </div>

            {(service.preparationInstructions || service.afterCareInstructions) && (
              <div className="mt-10 grid gap-5 sm:grid-cols-2">
                {service.preparationInstructions ? (
                  <CareCard
                    title="Before your appointment"
                    items={service.preparationInstructions.split("\n").filter(Boolean)}
                  />
                ) : null}
                {service.afterCareInstructions ? (
                  <CareCard
                    title="After-care"
                    items={service.afterCareInstructions.split("\n").filter(Boolean)}
                  />
                ) : null}
              </div>
            )}

            {/* ------------------------------------------------------- video */}
            {service.videos.length ? (
              <div className="mt-12">
                <h2 className="text-2xl">See it in motion</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {service.videos.map((video) => (
                    <div key={video.id} className="card overflow-hidden">
                      <video
                        controls
                        preload="metadata"
                        poster={video.thumbnailUrl ?? undefined}
                        className="aspect-video w-full bg-charcoal object-cover"
                      >
                        <source src={video.url} />
                        Your browser does not support embedded videos.
                      </video>
                      <p className="px-4 py-3 text-sm">{video.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ----------------------------------------------------- reviews */}
            <div className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-2xl">Customer reviews</h2>
                {service.ratingCount > 0 ? (
                  <StarRating value={service.ratingAverage} count={service.ratingCount} />
                ) : null}
              </div>

              {reviews.items.length ? (
                <>
                  <ul className="mt-6 space-y-5">
                    {reviews.items.map((review) => (
                      <li key={review.id} className="card-soft p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{review.customer.name}</p>
                            <p className="text-xs text-muted">{formatDate(review.createdAt)}</p>
                          </div>
                          <StarRating value={review.rating} showValue={false} />
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-charcoal-soft">{review.comment}</p>
                      </li>
                    ))}
                  </ul>

                  <Pagination
                    page={reviews.page}
                    totalPages={reviews.totalPages}
                    basePath={`/services/${service.slug}`}
                    searchParams={{ reviews: String(reviews.page) }}
                  />
                </>
              ) : (
                <p className="mt-4 rounded-2xl border border-line bg-cream-deep px-4 py-5 text-sm text-muted">
                  No reviews yet. Reviews can be written after a completed appointment — we would love to hear how your
                  visit went.
                </p>
              )}

              <ModalLauncher
                label="How do reviews work?"
                title="Verified reviews only"
                buttonClassName="btn-ghost btn-sm mt-3 text-muted"
              >
                <div className="space-y-3 text-sm text-charcoal-soft">
                  <p>
                    Reviews can only be written by customers who actually visited the studio: the review form unlocks
                    once an appointment for that service has been marked <strong>completed</strong>.
                  </p>
                  <p>
                    Every review can be edited or deleted by its author, and the studio never rewrites a customer&apos;s
                    words. If a review breaks our guidelines it is hidden or removed, and the moderation is recorded.
                  </p>
                  <p className="text-muted">You can write your review from “My appointments”.</p>
                </div>
              </ModalLauncher>
            </div>
          </div>

          {/* --------------------------------------------------------- aside */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="card p-6">
              <h2 className="font-display text-xl">Booking at a glance</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-rosegold" />
                  <span>Free online booking — confirmed by the studio.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-rosegold" />
                  <span>Cancel up to {content.cancellationWindowHours} hours before, free of charge.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-rosegold" />
                  <span>Consultation and design advice included.</span>
                </li>
              </ul>

              <Link href={`/booking?service=${service.slug}`} className="btn-primary mt-6 w-full">
                <CalendarCheck size={16} /> Book this service
              </Link>

              <Divider className="my-6" />

              <p className="text-xs uppercase tracking-[0.18em] text-muted">Prefer to talk first?</p>
              <p className="mt-2 text-sm text-charcoal-soft">
                Call the studio on{" "}
                <a href={`tel:${content.phone.replace(/\s/g, "")}`} className="text-rosegold-dark">
                  {content.phone}
                </a>{" "}
                or send a WhatsApp message — we usually reply within a few hours.
              </p>
            </div>

            {relatedDesigns.items.length ? (
              <div className="card mt-6 p-6">
                <h2 className="font-display text-xl">Gallery inspiration</h2>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {relatedDesigns.items.slice(0, 6).map((design) => (
                    <Link
                      key={design.id}
                      href={`/gallery/${design.id}`}
                      className="group relative aspect-square overflow-hidden rounded-xl bg-nude"
                    >
                      <Image
                        src={design.url}
                        alt={design.alt ?? design.title}
                        fill
                        sizes="120px"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    </Link>
                  ))}
                </div>
                <Link href="/gallery" className="mt-4 inline-flex items-center gap-1.5 text-sm text-rosegold-dark">
                  Browse all designs <ArrowRight size={14} />
                </Link>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {/* ---------------------------------------------------------- related */}
      {related.length ? (
        <section className="section bg-cream-deep">
          <div className="container-page">
            <SectionHeading align="left" eyebrow="You may also like" title="Related services" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <ServiceCard
                  key={item.id}
                  service={item}
                  saved={saved.serviceIds.has(item.id)}
                  isAuthenticated={Boolean(user)}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <dt className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-charcoal-soft">{value}</dd>
    </div>
  );
}

function CareCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card-soft p-5">
      <h3 className="flex items-center gap-2 font-display text-lg">
        <Sparkles size={16} className="text-rosegold" />
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm text-charcoal-soft">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rosegold" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
