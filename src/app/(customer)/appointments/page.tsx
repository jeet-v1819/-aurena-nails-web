import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, Clock, FileText, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listCustomerAppointments } from "@/server/services/bookings";
import { listCustomerReviews } from "@/server/services/reviews";
import { EmptyState, Pagination, StatusBadge } from "@/components/ui/primitives";
import { AppointmentActions } from "@/components/customer/appointment-actions";
import { formatDate, formatDuration } from "@/lib/format";
import { parsePage } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Appointments",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ status?: string | string[]; page?: string | string[] }>;

const TABS = [
  { value: "UPCOMING", label: "Upcoming" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ALL", label: "All" },
] as const;

export default async function AppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const session = await requireUser("/appointments");

  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = (TABS.find((tab) => tab.value === rawStatus)?.value ?? "UPCOMING") as (typeof TABS)[number]["value"];
  const page = parsePage(Array.isArray(params.page) ? params.page[0] : params.page);

  const [appointments, reviews] = await Promise.all([
    listCustomerAppointments(session.id, { status, page, pageSize: 8 }),
    listCustomerReviews(session.id),
  ]);

  const reviewByService = new Map(reviews.map((review) => [review.service.id, review]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/appointments?status=${tab.value}`}
            aria-current={status === tab.value ? "page" : undefined}
            className={
              status === tab.value
                ? "rounded-full border border-rosegold bg-blush px-3.5 py-1.5 text-sm text-rosegold-dark"
                : "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-charcoal-soft transition hover:border-rosegold-soft"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {appointments.items.length ? (
        <>
          <ul className="space-y-5">
            {appointments.items.map((appointment) => {
              const review = reviewByService.get(appointment.service.id);
              const canCancel = appointment.status === "PENDING" || appointment.status === "CONFIRMED";

              return (
                <li key={appointment.id} className="card overflow-hidden">
                  <div className="flex flex-col gap-5 p-5 sm:flex-row">
                    <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-nude sm:h-28 sm:w-28">
                      {appointment.service.image ? (
                        <Image
                          src={appointment.service.image}
                          alt=""
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-nude-dark">
                          <Sparkles size={22} />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-display text-xl">
                            <Link href={`/services/${appointment.service.slug}`} className="hover:text-rosegold-dark">
                              {appointment.service.name}
                            </Link>
                          </h2>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                            Ref {appointment.reference}
                          </p>
                        </div>
                        <StatusBadge status={appointment.status} label={appointment.statusLabel} />
                      </div>

                      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                        <div className="flex items-center gap-2">
                          <CalendarCheck size={14} className="text-rosegold" />
                          <dt className="sr-only">Date</dt>
                          <dd>{appointment.dateLabel}</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-rosegold" />
                          <dt className="sr-only">Time</dt>
                          <dd>{appointment.timeLabel}</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-rosegold" />
                          <dt className="sr-only">Duration</dt>
                          <dd>{formatDuration(appointment.durationMinutes)}</dd>
                        </div>
                      </dl>

                      {appointment.customerNote ? (
                        <p className="mt-3 rounded-xl bg-cream-deep p-3 text-xs text-muted">
                          <span className="font-medium text-charcoal-soft">Your note: </span>
                          {appointment.customerNote}
                        </p>
                      ) : null}

                      {appointment.adminNote ? (
                        <p className="mt-3 rounded-xl bg-blush/60 p-3 text-xs text-charcoal-soft">
                          <span className="font-medium">From the studio: </span>
                          {appointment.adminNote}
                        </p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted">Requested {formatDate(appointment.createdAt)}</p>
                        <AppointmentActions
                          appointmentId={appointment.id}
                          serviceId={appointment.service.id}
                          serviceName={appointment.service.name}
                          reference={appointment.reference}
                          status={appointment.status}
                          canCancel={canCancel}
                          canReview={appointment.canReview}
                          review={review ? { id: review.id, rating: review.rating, isVisible: review.isVisible } : null}
                          reviewComment={review?.comment ?? null}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <Pagination
            page={appointments.page}
            totalPages={appointments.totalPages}
            basePath="/appointments"
            searchParams={{ status }}
          />
        </>
      ) : (
        <EmptyState
          icon={<CalendarPlus size={26} />}
          title={status === "UPCOMING" ? "No upcoming appointments" : "Nothing here yet"}
          description="Book a slot and it will appear here with your reference number, along with reminders and after-care notes."
          action={{ href: "/booking", label: "Book an appointment" }}
        />
      )}

      <div className="rounded-2xl bg-cream-deep p-5 text-xs leading-relaxed text-muted">
        <p className="inline-flex items-center gap-1.5 font-medium text-charcoal-soft">
          <FileText size={13} className="text-rosegold" /> Good to know
        </p>
        <p className="mt-2">
          Cancellations are free up to 12 hours before your appointment. Reviews can be written once an appointment is
          marked completed by the studio — and edited or deleted afterwards from this page.
        </p>
      </div>
    </div>
  );
}
