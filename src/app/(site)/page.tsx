import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Clock,
  HeartHandshake,
  MapPin,
  PlayCircle,
  Quote,
  Sparkles,
  Stars,
} from "lucide-react";
import { getSiteContent } from "@/server/services/content";
import { getBusinessHours } from "@/server/services/business-hours";
import { listFeaturedServices } from "@/server/services/catalog";
import { listGalleryImages } from "@/server/services/gallery";
import { listVideos } from "@/server/services/videos";
import { listServiceReviews } from "@/server/services/reviews";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getSavedState } from "@/server/services/wishlist";
import { ServiceCard } from "@/components/site/cards";
import { GalleryMasonry } from "@/components/site/gallery-masonry";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/site/motion";
import { SectionHeading, StarRating } from "@/components/ui/primitives";
import { Instagram } from "@/components/ui/brand-icons";
import { formatDuration, formatMinutes } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: `${content.siteName} — ${content.tagline}`,
    description: content.seoDescription,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const [content, hours, services, recentDesigns, videos, user] = await Promise.all([
    getSiteContent(),
    getBusinessHours(),
    listFeaturedServices(6),
    listGalleryImages({ sort: "newest", take: 8 }),
    listVideos({ sort: "featured", take: 3 }),
    getCurrentUser(),
  ]);

  const saved = await getSavedState(user?.id ?? null);

  // Social proof pulled from real reviews of completed appointments.
  const topService = services[0];
  const testimonials = topService
    ? (await listServiceReviews(topService.id, { pageSize: 3 })).items
    : await prisma.review
        .findMany({
          where: { isVisible: true },
          orderBy: { rating: "desc" },
          take: 3,
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } }, service: { select: { name: true, slug: true } } },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            rating: row.rating,
            comment: row.comment,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            isVisible: row.isVisible,
            adminNote: row.adminNote,
            appointmentId: row.appointmentId,
            customer: {
              id: "n/a",
              name: `${row.user.firstName} ${row.user.lastName?.[0] ?? ""}`.trim(),
              avatarUrl: row.user.avatarUrl,
            },
            service: row.service,
          }))
        );

  const today = hours.find((day) => day.dayOfWeek === new Date().getUTCDay());
  const openDays = hours.filter((day) => day.isOpen);

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="surface-gradient relative overflow-hidden">
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <FadeIn>
            <p className="eyebrow">{content.heroEyebrow}</p>
            <h1 className="mt-4 text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">{content.heroTitle}</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">{content.heroDescription}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/booking" className="btn-primary btn-lg">
                <CalendarCheck size={18} />
                {content.heroPrimaryCta}
              </Link>
              <Link href="/gallery" className="btn-outline btn-lg">
                <Sparkles size={18} />
                {content.heroSecondaryCta}
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Designs created" value="1,200+" />
              <Stat label="Average rating" value="4.9 / 5" />
              <Stat label="Years of artistry" value="8+" />
            </dl>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-soft)] sm:aspect-[5/5]">
                <Image
                  src={content.heroImage}
                  alt="Elegant nail art created at Aurena Nails"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>

              <div className="absolute -bottom-5 left-4 hidden max-w-[15rem] rounded-2xl border border-line bg-white/95 p-4 shadow-[var(--shadow-card)] sm:block">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
                  <Clock size={13} className="text-rosegold" />
                  {today?.isOpen ? "Open today" : "Closed today"}
                </p>
                <p className="mt-1.5 text-sm">
                  {today?.isOpen
                    ? `${formatMinutes(today.openMinutes)} – ${formatMinutes(today.closeMinutes)}`
                    : "Book online for the next open day"}
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* -------------------------------------------------------- services */}
      <section className="section">
        <div className="container-page">
          <SectionHeading
            eyebrow="Signature services"
            title={content.servicesTitle}
            description={content.servicesDescription}
          />

          <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <StaggerItem key={service.id}>
                <ServiceCard
                  service={service}
                  saved={saved.serviceIds.has(service.id)}
                  isAuthenticated={Boolean(user)}
                />
              </StaggerItem>
            ))}
          </StaggerGroup>

          <div className="mt-10 text-center">
            <Link href="/services" className="btn-outline">
              View all services <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- gallery */}
      <section className="section bg-cream-deep">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              align="left"
              eyebrow="Nail art gallery"
              title={content.galleryTitle}
              description={content.galleryDescription}
            />
            <Link href="/gallery" className="btn-outline">
              View all gallery <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-10">
            <GalleryMasonry
              images={recentDesigns.items}
              savedIds={Array.from(saved.galleryIds)}
              isAuthenticated={Boolean(user)}
            />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- about */}
      <section className="section">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <FadeIn>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-card)]">
              <Image
                src={content.aboutImage}
                alt="Inside the Aurena Nails studio"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.08}>
            <p className="eyebrow">Our studio</p>
            <h2 className="mt-3 text-3xl md:text-4xl">{content.aboutTitle}</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">{content.aboutDescription}</p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {content.whyUs.slice(0, 4).map((reason) => (
                <li key={reason} className="flex items-start gap-2.5 text-sm">
                  <BadgeCheck size={17} className="mt-0.5 shrink-0 text-rosegold" />
                  <span className="text-charcoal-soft">{reason}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/about" className="btn-primary">
                Read our story
              </Link>
              <Link href="/contact" className="btn-outline">
                <MapPin size={15} /> Visit the studio
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ---------------------------------------------------------- videos */}
      {videos.items.length ? (
        <section className="section bg-cream-deep">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading
                align="left"
                eyebrow="Watch the craft"
                title="Nail art in motion"
                description="Short videos from the studio — techniques, textures and finished sets."
              />
              <Link href="/videos" className="btn-outline">
                All videos <ArrowRight size={15} />
              </Link>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.items.map((video) => (
                <Link
                  key={video.id}
                  href={`/videos/${video.id}`}
                  className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
                >
                  <div className="relative aspect-video bg-charcoal">
                    {video.thumbnailUrl ? (
                      <Image src={video.thumbnailUrl} alt={video.title} fill sizes="33vw" className="object-cover opacity-90" />
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-rosegold">
                        <PlayCircle size={26} />
                      </span>
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="text-[0.68rem] uppercase tracking-[0.2em] text-rosegold">{video.category.name}</p>
                    <p className="mt-1.5 font-display text-lg">{video.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------- testimonials */}
      {testimonials.length ? (
        <section className="section">
          <div className="container-page">
            <SectionHeading
              eyebrow="Guest experiences"
              title="Loved by our clients"
              description="Reviews written by customers after their visits."
            />

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.map((review) => (
                <figure key={review.id} className="card-soft flex h-full flex-col p-6">
                  <Quote size={20} className="text-rosegold-soft" />
                  <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-charcoal-soft">
                    “{review.comment}”
                  </blockquote>
                  <figcaption className="mt-5 border-t border-line pt-4">
                    <StarRating value={review.rating} showValue={false} />
                    <p className="mt-2 text-sm font-medium">{review.customer.name}</p>
                    <p className="text-xs text-muted">{review.service.name}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- visit */}
      <section className="section bg-cream-deep">
        <div className="container-page grid gap-10 lg:grid-cols-2">
          <FadeIn>
            <p className="eyebrow">Visit us</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Studio hours &amp; location</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
              {content.hoursNote} Everything is by appointment, so you always get an unhurried slot.
            </p>

            <ul className="mt-6 space-y-2 text-sm">
              {openDays.map((day) => (
                <li key={day.dayOfWeek} className="flex justify-between border-b border-line pb-2">
                  <span>{day.dayName}</span>
                  <span className="text-muted">
                    {formatMinutes(day.openMinutes)} – {formatMinutes(day.closeMinutes)}
                  </span>
                </li>
              ))}
              {hours
                .filter((day) => !day.isOpen)
                .map((day) => (
                  <li key={day.dayOfWeek} className="flex justify-between border-b border-line pb-2">
                    <span>{day.dayName}</span>
                    <span className="text-rosegold">Closed</span>
                  </li>
                ))}
            </ul>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/booking" className="btn-primary">
                <CalendarCheck size={16} /> Book appointment
              </Link>
              <Link href="/contact" className="btn-outline">
                Get directions
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.08}>
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blush text-rosegold-dark">
                  <HeartHandshake size={20} />
                </span>
                <div>
                  <p className="font-display text-lg">A note from {content.artistName}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Lead nail artist</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">{content.artistBio}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MiniCard icon={<Stars size={16} />} title="Custom design" text="Drawn for your hands" />
                <MiniCard icon={<BadgeCheck size={16} />} title="Sterile tools" text="Hospital-grade prep" />
                <MiniCard icon={<Clock size={16} />} title="Never rushed" text="One client at a time" />
              </div>

              <a
                href={content.instagram}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-6 inline-flex items-center gap-2 text-sm text-rosegold-dark"
              >
                <Instagram size={15} /> See daily designs on Instagram
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ------------------------------------------------------ final CTA */}
      <section className="container-page py-16">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-rosegold to-rosegold-dark px-8 py-14 text-center text-white">
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/40 blur-3xl" />
            <div className="absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-white/30 blur-3xl" />
          </div>

          <div className="relative">
            <p className="text-xs uppercase tracking-[0.3em] text-white/80">Ready when you are</p>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl text-white md:text-4xl">
              Let’s design a set that feels like you.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-white/85">
              Pick a service, choose a time that suits you and we will take care of the rest.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/booking" className="btn bg-white text-rosegold-dark hover:bg-cream">
                <CalendarCheck size={17} /> Book Appointment
              </Link>
              <Link href="/services" className="btn border-white/60 text-white hover:bg-white/10">
                Browse services
                {topService ? <span className="sr-only"> starting from {formatDuration(topService.durationMinutes)}</span> : null}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/70 px-4 py-3">
      <dt className="text-[0.65rem] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="mt-1 font-display text-xl">{value}</dd>
    </div>
  );
}

function MiniCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-cream px-3 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-rosegold">{icon}</span>
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="text-xs text-muted">{text}</p>
    </div>
  );
}
