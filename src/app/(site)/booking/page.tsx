import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, LogIn, Phone, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listBookableServices } from "@/server/services/catalog";
import { getSiteContent } from "@/server/services/content";
import { BookingWizard, type BookableServiceOption } from "@/components/site/booking-wizard";
import { getBusinessHours } from "@/server/services/business-hours";
import { formatMinutes } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: "Book an Appointment",
    description: `Book your nail appointment at ${content.siteName} in five simple steps — choose a service, date and time, add a note and confirm. Real-time availability, instant reference number.`,
    alternates: { canonical: "/booking" },
  };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function BookingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedSlug = Array.isArray(params.service) ? params.service[0] : params.service;

  const [user, services, content, hours] = await Promise.all([
    getCurrentUser(),
    listBookableServices(),
    getSiteContent(),
    getBusinessHours(),
  ]);

  const options: BookableServiceOption[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    slug: service.slug,
    shortDescription: service.shortDescription,
    durationMinutes: service.durationMinutes,
    startingPrice: decimalToNumber(service.startingPrice),
    currency: service.currency,
    categoryName: service.category.name,
    image: service.images[0]?.url ?? null,
  }));

  const initialServiceId = requestedSlug
    ? (options.find((option) => option.slug === requestedSlug)?.id ?? undefined)
    : undefined;

  const openDays = hours.filter((day) => day.isOpen);

  return (
    <>
      <section className="surface-gradient border-b border-line">
        <div className="container-page py-12">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link href="/" className="hover:text-charcoal">
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-charcoal-soft">Book</span>
          </nav>

          <div className="mt-5 max-w-3xl">
            <p className="eyebrow">Appointments</p>
            <h1 className="mt-3 text-4xl md:text-5xl">Reserve your seat at the table</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
              Five quick steps and your slot is requested. Availability is live — the times you see are the times we can
              genuinely do.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          {!user ? (
            <div className="mx-auto max-w-2xl text-center">
              <div className="card p-8">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush text-rosegold">
                  <CalendarCheck size={26} />
                </span>
                <h2 className="mt-5 text-2xl">Sign in to book your slot</h2>
                <p className="mt-3 text-sm text-muted">
                  Bookings are tied to your account so you can track your appointment, manage the note for your artist,
                  and cancel or review afterwards. It takes under a minute.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/booking${requestedSlug ? `?service=${requestedSlug}` : ""}`)}`}
                    className="btn-primary"
                  >
                    <LogIn size={16} /> Sign in
                  </Link>
                  <Link href="/register" className="btn-outline">
                    Create an account
                  </Link>
                </div>

                <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted">
                  <ShieldCheck size={14} className="text-rosegold" />
                  Your details stay private — we never share them.
                </p>
              </div>

              <div className="card-soft mt-6 p-6 text-left">
                <h3 className="font-display text-lg">Prefer to book over the phone?</h3>
                <p className="mt-2 text-sm text-muted">
                  Call the studio on{" "}
                  <a href={`tel:${content.phone.replace(/\s/g, "")}`} className="text-rosegold-dark">
                    {content.phone}
                  </a>{" "}
                  during opening hours and we will find a slot for you.
                </p>
                <dl className="mt-4 grid gap-1.5 text-xs text-muted sm:grid-cols-2">
                  {openDays.map((day) => (
                    <div key={day.dayOfWeek} className="flex items-center justify-between gap-3 border-b border-line pb-1.5">
                      <dt>{day.dayName}</dt>
                      <dd className="text-charcoal-soft">
                        {formatMinutes(day.openMinutes)} – {formatMinutes(day.closeMinutes)}
                      </dd>
                    </div>
                  ))}
                  {hours.some((day) => !day.isOpen) ? (
                    <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5">
                      <dt>Closed</dt>
                      <dd className="text-charcoal-soft">
                        {hours
                          .filter((day) => !day.isOpen)
                          .map((day) => day.dayName)
                          .join(", ")}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted">
                  <Phone size={13} className="text-rosegold" /> {content.hoursNote}
                </p>
              </div>
            </div>
          ) : options.length ? (
            <BookingWizard
              services={options}
              initialServiceId={initialServiceId}
              customerName={`${user.firstName} ${user.lastName}`.trim()}
              bookingNote={content.bookingNote}
              cancellationWindowHours={content.cancellationWindowHours}
            />
          ) : (
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-2xl">Booking is momentarily closed</h2>
              <p className="mt-3 text-sm text-muted">
                There are no bookable services published right now. Please check back shortly or send us a message and we
                will arrange your appointment personally.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/contact" className="btn-primary">
                  Contact the studio
                </Link>
                <Link href="/services" className="btn-outline">
                  Browse services
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
