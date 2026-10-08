import Link from "next/link";
import { CalendarDays, Download, Filter } from "lucide-react";
import { listAppointmentsForAdmin } from "@/server/services/bookings";
import { listBookableServices } from "@/server/services/catalog";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { AppointmentActions } from "@/components/admin/appointment-actions";
import { EmptyState, Pagination, StatusBadge } from "@/components/ui/primitives";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatMinutes } from "@/lib/format";
import { parsePage } from "@/lib/utils";

export const metadata = { title: "Appointments · Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AdminAppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = (single(params.status) ?? "ALL") as (typeof APPOINTMENT_STATUSES)[number] | "ALL" | "UPCOMING";
  const filters = {
    search: single(params.q),
    status: status === "UPCOMING" ? "ALL" : status,
    date: single(params.date),
    serviceId: single(params.service),
    page: parsePage(single(params.page)),
    pageSize: 15,
  };

  const [appointments, services] = await Promise.all([listAppointmentsForAdmin(filters), listBookableServices()]);

  const tabs = [
    { value: "ALL", label: "All", count: Object.values(appointments.statusCounts).reduce((sum, n) => sum + n, 0) },
    ...APPOINTMENT_STATUSES.map((value) => ({
      value,
      label: APPOINTMENT_STATUS_LABELS[value],
      count: appointments.statusCounts[value] ?? 0,
    })),
  ];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Bookings"
        title="Appointments"
        description="Confirm, complete or reject requests, and leave notes your clients can read. The studio takes no online payments, so nothing here is a transaction."
        actions={
          <Link href="/admin/business-hours" className="btn-outline btn-sm">
            <Filter size={15} /> Opening hours
          </Link>
        }
      />

      {/* ---------------------------------------------------------- filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = status === tab.value || (tab.value === "ALL" && !tabs.some((t) => t.value === status));
            const query = new URLSearchParams();
            if (tab.value !== "ALL") query.set("status", tab.value);
            if (filters.search) query.set("q", filters.search);
            if (filters.date) query.set("date", filters.date);

            return (
              <Link
                key={tab.value}
                href={`/admin/appointments${query.toString() ? `?${query}` : ""}`}
                className={
                  active
                    ? "rounded-full border border-rosegold bg-blush px-3.5 py-1.5 text-sm text-rosegold-dark"
                    : "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-charcoal-soft transition hover:border-rosegold-soft"
                }
              >
                {tab.label} <span className="text-muted">{tab.count}</span>
              </Link>
            );
          })}
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
          {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
          <label className="min-w-0">
            <span className="sr-only">Search appointments</span>
            <input
              name="q"
              defaultValue={filters.search ?? ""}
              placeholder="Reference, name, email, mobile…"
              className="input"
            />
          </label>
          <label className="min-w-0">
            <span className="sr-only">Filter by date</span>
            <input type="date" name="date" defaultValue={filters.date ?? ""} className="input" />
          </label>
          <label className="min-w-0">
            <span className="sr-only">Filter by service</span>
            <select name="service" defaultValue={filters.serviceId ?? ""} className="select">
              <option value="">All services</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary">
            Apply filters
          </button>
        </form>
      </div>

      {/* ------------------------------------------------------------ table */}
      <div className="mt-6">
        {appointments.items.length ? (
          <>
            {/* Desktop table */}
            <div className="table-wrap hidden lg:block">
              <table className="table-base">
                <caption className="sr-only">Appointments list</caption>
                <thead>
                  <tr>
                    <th scope="col">Client</th>
                    <th scope="col">Service</th>
                    <th scope="col">When</th>
                    <th scope="col">Status</th>
                    <th scope="col">Notes</th>
                    <th scope="col" className="text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.items.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>
                        <p className="font-medium">{appointment.customer.name}</p>
                        <p className="text-xs text-muted">{appointment.customer.mobile}</p>
                        <p className="text-xs text-muted">{appointment.customer.email}</p>
                      </td>
                      <td>
                        <p className="font-medium">{appointment.service.name}</p>
                        <p className="text-xs text-muted">{appointment.reference}</p>
                      </td>
                      <td>
                        <p>{formatDate(appointment.date)}</p>
                        <p className="text-xs text-muted">
                          {formatMinutes(appointment.startMinutes)} – {formatMinutes(appointment.endMinutes)}
                        </p>
                      </td>
                      <td>
                        <StatusBadge status={appointment.status} label={appointment.statusLabel} />
                      </td>
                      <td className="max-w-[16rem]">
                        {appointment.customerNote ? (
                          <p className="text-xs text-muted">
                            <span className="font-medium text-charcoal-soft">Client: </span>
                            {appointment.customerNote}
                          </p>
                        ) : null}
                        {appointment.adminNote ? (
                          <p className="mt-1 text-xs text-muted">
                            <span className="font-medium text-charcoal-soft">Studio: </span>
                            {appointment.adminNote}
                          </p>
                        ) : null}
                        {!appointment.customerNote && !appointment.adminNote ? (
                          <span className="text-xs text-muted">—</span>
                        ) : null}
                      </td>
                      <td>
                        <AppointmentActions
                          appointmentId={appointment.id}
                          reference={appointment.reference}
                          status={appointment.status}
                          adminNote={appointment.adminNote}
                          customerName={appointment.customer.name}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-4 lg:hidden">
              {appointments.items.map((appointment) => (
                <li key={appointment.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg">{appointment.customer.name}</p>
                      <p className="text-xs text-muted">{appointment.reference}</p>
                    </div>
                    <StatusBadge status={appointment.status} label={appointment.statusLabel} />
                  </div>

                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Service</dt>
                      <dd className="text-right">{appointment.service.name}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">When</dt>
                      <dd className="text-right">
                        {formatDate(appointment.date)}
                        <br />
                        {formatMinutes(appointment.startMinutes)} – {formatMinutes(appointment.endMinutes)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Contact</dt>
                      <dd className="text-right">{appointment.customer.mobile}</dd>
                    </div>
                  </dl>

                  {appointment.customerNote ? (
                    <p className="mt-3 rounded-xl bg-cream-deep p-3 text-xs text-muted">
                      <span className="font-medium text-charcoal-soft">Client: </span>
                      {appointment.customerNote}
                    </p>
                  ) : null}

                  <div className="mt-4">
                    <AppointmentActions
                      appointmentId={appointment.id}
                      reference={appointment.reference}
                      status={appointment.status}
                      adminNote={appointment.adminNote}
                      customerName={appointment.customer.name}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={appointments.page}
              totalPages={appointments.totalPages}
              basePath="/admin/appointments"
              searchParams={{
                status: status === "ALL" ? undefined : status,
                q: filters.search,
                date: filters.date,
                service: filters.serviceId,
              }}
            />
          </>
        ) : (
          <EmptyState
            icon={<CalendarDays size={26} />}
            title="No appointments match those filters"
            description="Try a different status, clear the date filter, or search by reference."
            action={{ href: "/admin/appointments", label: "Reset filters" }}
          />
        )}
      </div>

      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted">
        <Download size={13} /> Tip: filter by today&apos;s date and print the list for the studio desk.
      </p>
    </div>
  );
}
