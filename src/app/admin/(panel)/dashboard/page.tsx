import Link from "next/link";
import Image from "next/image";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Images,
  Inbox,
  Sparkles,
  Star,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  getDashboardStats,
  getMonthlyActivity,
  getPopularServices,
  getRecentActivity,
} from "@/server/services/dashboard";
import { upcomingAppointmentsForAdmin } from "@/server/services/bookings";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import {
  MonthlyActivityChart,
  PopularServicesChart,
  StatusDistributionChart,
} from "@/components/admin/dashboard-charts";
import { StatusBadge, EmptyState } from "@/components/ui/primitives";
import { formatDate, formatMinutes, formatRelativeTime, initials } from "@/lib/format";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";

export default async function AdminDashboardPage() {
  const [stats, monthly, popular, upcoming, activity] = await Promise.all([
    getDashboardStats(),
    getMonthlyActivity(6),
    getPopularServices(5),
    upcomingAppointmentsForAdmin(6),
    getRecentActivity(5),
  ]);

  const statusData = [
    { name: APPOINTMENT_STATUS_LABELS.PENDING, value: stats.appointments.pending },
    { name: APPOINTMENT_STATUS_LABELS.CONFIRMED, value: stats.appointments.confirmed },
    { name: APPOINTMENT_STATUS_LABELS.COMPLETED, value: stats.appointments.completed },
    { name: APPOINTMENT_STATUS_LABELS.CANCELLED, value: stats.appointments.cancelled },
    { name: APPOINTMENT_STATUS_LABELS.REJECTED, value: stats.appointments.rejected },
  ].filter((entry) => entry.value > 0);

  const cards = [
    {
      label: "Pending appointments",
      value: stats.appointments.pending,
      hint: `${stats.appointments.today} today`,
      icon: CalendarCheck,
      href: "/admin/appointments?status=PENDING",
      tone: "blush",
    },
    {
      label: "Upcoming appointments",
      value: stats.appointments.upcoming,
      hint: "Pending + confirmed",
      icon: CalendarDays,
      href: "/admin/appointments",
      tone: "plain",
    },
    {
      label: "Customers",
      value: stats.customers.total,
      hint: `${stats.customers.newThisMonth} new this month`,
      icon: Users,
      href: "/admin/customers",
      tone: "plain",
    },
    {
      label: "Unread messages",
      value: stats.messages.unread,
      hint: `${stats.messages.total} total`,
      icon: Inbox,
      href: "/admin/messages?status=unread",
      tone: "blush",
    },
    {
      label: "Average rating",
      value: stats.reviews.average ? stats.reviews.average.toFixed(2) : "—",
      hint: `${stats.reviews.total} reviews · ${stats.reviews.hidden} hidden`,
      icon: Star,
      href: "/admin/reviews",
      tone: "plain",
    },
    {
      label: "Services",
      value: stats.services.active,
      hint: `${stats.services.featured} featured`,
      icon: Sparkles,
      href: "/admin/services",
      tone: "plain",
    },
    {
      label: "Gallery designs",
      value: stats.gallery.active,
      hint: `${stats.gallery.total} total`,
      icon: Images,
      href: "/admin/gallery",
      tone: "plain",
    },
    {
      label: "Upcoming holidays",
      value: stats.holidays.upcoming,
      hint: "Studio closures",
      icon: Clock,
      href: "/admin/holidays",
      tone: "plain",
    },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Overview"
        title="Studio dashboard"
        description="Everything happening at Aurena Nails right now — appointments, clients, reviews and content. All figures come straight from the database; this studio takes bookings, not payments."
      />

      {/* ------------------------------------------------------------ cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.label}
              href={card.href}
              className={
                card.tone === "blush"
                  ? "card p-5 ring-1 ring-rosegold-soft transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                  : "card p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blush text-rosegold">
                  <Icon size={18} />
                </span>
                <TrendingUp size={15} className="text-muted/50" />
              </div>
              <p className="mt-4 font-display text-3xl">{card.value}</p>
              <p className="mt-1 text-sm font-medium">{card.label}</p>
              <p className="mt-0.5 text-xs text-muted">{card.hint}</p>
            </Link>
          );
        })}
      </div>

      {/* ----------------------------------------------------------- charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6" aria-labelledby="chart-activity">
          <h2 id="chart-activity" className="font-display text-xl">
            Appointments & new customers
          </h2>
          <p className="mt-1 text-sm text-muted">Last six months, based on booking and registration dates.</p>
          <div className="mt-5">
            <MonthlyActivityChart data={monthly} />
          </div>
        </section>

        <section className="card p-6" aria-labelledby="chart-popular">
          <h2 id="chart-popular" className="font-display text-xl">
            Most booked services
          </h2>
          <p className="mt-1 text-sm text-muted">Where clients choose to spend their appointment time.</p>
          <div className="mt-5">
            {popular.length ? (
              <PopularServicesChart data={popular} />
            ) : (
              <p className="grid h-72 place-items-center text-sm text-muted">No appointments recorded yet.</p>
            )}
          </div>
        </section>

        <section className="card p-6" aria-labelledby="chart-status">
          <h2 id="chart-status" className="font-display text-xl">
            Appointment status mix
          </h2>
          <p className="mt-1 text-sm text-muted">How bookings resolve across the studio.</p>
          <div className="mt-5">
            {statusData.length ? (
              <StatusDistributionChart data={statusData} />
            ) : (
              <p className="grid h-72 place-items-center text-sm text-muted">Nothing booked yet.</p>
            )}
          </div>
        </section>

        <section className="card p-6" aria-labelledby="upcoming-list">
          <div className="flex items-center justify-between gap-4">
            <h2 id="upcoming-list" className="font-display text-xl">
              Next appointments
            </h2>
            <Link href="/admin/appointments" className="text-sm text-rosegold-dark">
              View all
            </Link>
          </div>

          {upcoming.length ? (
            <ul className="mt-4 divide-y divide-line">
              {upcoming.map((appointment) => (
                <li key={appointment.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blush text-xs font-medium text-rosegold-dark">
                    {appointment.customer.avatarUrl ? (
                      <Image
                        src={appointment.customer.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(appointment.customer.name)
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{appointment.customer.name}</p>
                    <p className="truncate text-xs text-muted">
                      {appointment.service.name} · {formatDate(appointment.date)} at{" "}
                      {formatMinutes(appointment.startMinutes)}
                    </p>
                  </div>
                  <StatusBadge status={appointment.status} label={appointment.statusLabel} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title="No upcoming appointments"
              description="New requests appear here the moment a client books."
            />
          )}
        </section>
      </div>

      {/* --------------------------------------------------------- activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="recent-customers">
          <h2 id="recent-customers" className="font-display text-xl">
            Newest customers
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {activity.customers.map((customer) => (
              <li key={customer.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="truncate text-xs text-muted">{customer.email}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">{formatRelativeTime(customer.createdAt)}</span>
              </li>
            ))}
            {!activity.customers.length ? <li className="py-3 text-sm text-muted">No customers yet.</li> : null}
          </ul>
          <Link href="/admin/customers" className="mt-4 inline-flex items-center gap-1.5 text-sm text-rosegold-dark">
            <UserPlus size={14} /> Manage customers
          </Link>
        </section>

        <section className="card p-6" aria-labelledby="recent-reviews">
          <h2 id="recent-reviews" className="font-display text-xl">
            Latest reviews
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {activity.reviews.map((review) => (
              <li key={review.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">
                    {review.user.firstName} {review.user.lastName}
                  </p>
                  <span className="shrink-0 text-xs text-rosegold">{"★".repeat(review.rating)}</span>
                </div>
                <p className="truncate text-xs text-muted">
                  {review.service.name} · {review.isVisible ? "visible" : "hidden"} ·{" "}
                  {formatRelativeTime(review.createdAt)}
                </p>
              </li>
            ))}
            {!activity.reviews.length ? <li className="py-3 text-sm text-muted">No reviews yet.</li> : null}
          </ul>
          <Link href="/admin/reviews" className="mt-4 inline-flex items-center gap-1.5 text-sm text-rosegold-dark">
            <Star size={14} /> Moderate reviews
          </Link>
        </section>
      </div>
    </div>
  );
}
