import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Award, CalendarCheck, HeartHandshake, Leaf, ShieldCheck, Sparkles, Star } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getSiteContent } from "@/server/services/content";
import { getBusinessHours } from "@/server/services/business-hours";
import { FadeIn } from "@/components/site/motion";
import { SectionHeading, StatPill } from "@/components/ui/primitives";
import { formatMinutes } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: "About the Studio",
    description: content.aboutIntro || `Meet the artist behind ${content.siteName} — our story, our standards of hygiene, and the experience we create for every client.`,
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const [content, hours, stats] = await Promise.all([
    getSiteContent(),
    getBusinessHours(),
    Promise.all([
      prisma.service.count({ where: { isActive: true, deletedAt: null } }),
      prisma.galleryImage.count({ where: { isActive: true, deletedAt: null } }),
      prisma.appointment.count({ where: { status: "COMPLETED" } }),
      prisma.review.aggregate({ where: { isVisible: true }, _avg: { rating: true }, _count: { _all: true } }),
    ]),
  ]);

  const [serviceCount, designCount, completedCount, reviewStats] = stats;
  const averageRating = reviewStats._avg.rating ? Number(reviewStats._avg.rating).toFixed(1) : null;

  const values = [
    {
      icon: <Leaf size={18} />,
      title: "Nail health first",
      body: "We never file down more than the design needs. Prep is gentle, products are professional-grade, and we would rather talk you out of a risky treatment than rush it.",
    },
    {
      icon: <ShieldCheck size={18} />,
      title: "Studio-grade hygiene",
      body: "Tools are sterilised between every client, files and buffers are single-use, and every surface is disinfected before your hands touch it.",
    },
    {
      icon: <HeartHandshake size={18} />,
      title: "Honest pricing",
      body: "Prices on the site are starting points. Your artist quotes the exact amount before starting, so there are never surprises at the end.",
    },
    {
      icon: <Sparkles size={18} />,
      title: "Design made for you",
      body: "Bring a screenshot, a mood, or nothing at all — we will shape the design around your nail length, lifestyle and the occasion.",
    },
  ];

  return (
    <>
      <section className="surface-gradient border-b border-line">
        <div className="container-page py-14">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link href="/" className="hover:text-charcoal">
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-charcoal-soft">About</span>
          </nav>

          <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:items-center">
            <FadeIn>
              <p className="eyebrow">Our story</p>
              <h1 className="mt-3 text-4xl md:text-5xl">{content.aboutPageTitle}</h1>
              <p className="mt-5 text-sm leading-relaxed text-muted md:text-base">{content.aboutIntro}</p>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatPill label="Services" value={serviceCount} />
                <StatPill label="Designs" value={designCount} />
                <StatPill label="Completed" value={completedCount} />
                <StatPill label="Avg rating" value={averageRating ? `${averageRating}★` : "New"} />
              </div>
            </FadeIn>

            <FadeIn delay={0.08}>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative col-span-2 aspect-16/11 overflow-hidden rounded-[1.75rem] border border-line bg-nude">
                  <Image
                    src={content.aboutImage1}
                    alt={`Inside the ${content.siteName} studio`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-cover"
                  />
                </div>
                <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border border-line bg-nude">
                  <Image
                    src={content.aboutImage2}
                    alt="Nail art detail"
                    fill
                    sizes="(max-width: 1024px) 50vw, 22vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center rounded-[1.5rem] bg-blush p-5">
                  <Award size={20} className="text-rosegold" />
                  <p className="mt-3 font-display text-lg leading-snug">Every set finished by hand, never rushed.</p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 className="text-3xl">How it began</h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted md:text-base">
              {content.story.split("\n").map((paragraph, index) =>
                paragraph.trim() ? <p key={index}>{paragraph}</p> : null
              )}
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <article className="card-soft p-6">
                <h3 className="font-display text-xl">Our mission</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{content.mission}</p>
              </article>
              <article className="card-soft p-6">
                <h3 className="font-display text-xl">Our vision</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{content.vision}</p>
              </article>
            </div>
          </div>

          <aside>
            <div className="card p-6">
              <h2 className="font-display text-xl">Meet your artist</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-rosegold">{content.artistName}</p>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                {content.artistBio.split("\n").map((paragraph, index) =>
                  paragraph.trim() ? <p key={index}>{paragraph}</p> : null
                )}
              </div>
              <Link href="/booking" className="btn-primary mt-6 w-full">
                <CalendarCheck size={16} /> Book an appointment
              </Link>
            </div>

            <div className="card mt-6 p-6">
              <h2 className="font-display text-xl">Why clients choose us</h2>
              <ul className="mt-4 space-y-3 text-sm text-charcoal-soft">
                {(content.whyUs.length
                  ? content.whyUs
                  : [
                      "Consultation with every appointment",
                      "Sterilised, single-use tools",
                      "Honest, upfront pricing",
                      "Designs tailored to your nail shape",
                    ]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Star size={14} className="mt-1 shrink-0 text-rosegold" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card mt-6 p-6">
              <h2 className="font-display text-xl">Studio hours</h2>
              <dl className="mt-4 space-y-2 text-sm">
                {hours.map((day) => (
                  <div key={day.dayOfWeek} className="flex items-center justify-between border-b border-line pb-1.5">
                    <dt className="text-muted">{day.dayName}</dt>
                    <dd className={day.isOpen ? "text-charcoal-soft" : "text-muted"}>
                      {day.isOpen
                        ? `${formatMinutes(day.openMinutes)} – ${formatMinutes(day.closeMinutes)}`
                        : "Closed"}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted">{content.hoursNote}</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="section bg-cream-deep">
        <div className="container-page">
          <SectionHeading eyebrow="What we stand for" title="A studio built on care" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <article key={value.title} className="card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blush text-rosegold">
                  {value.icon}
                </span>
                <h3 className="mt-4 font-display text-lg">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{value.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="rounded-[1.75rem] bg-gradient-to-br from-blush to-cream-deep px-8 py-12 text-center">
            <h2 className="text-3xl">{content.aboutCtaTitle}</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted">
              Pick a service, choose a time that suits you, and we will take care of the rest. Appointments are
              confirmed by the studio before your visit.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/booking" className="btn-primary btn-lg">
                <CalendarCheck size={17} /> Book Appointment
              </Link>
              <Link href="/contact" className="btn-outline btn-lg">
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
