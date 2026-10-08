/**
 * Appointment booking and lifecycle.
 *
 * Statuses: PENDING → CONFIRMED → COMPLETED, with CANCELLED / REJECTED as the
 * terminating states. Every transition is written to `AppointmentEvent`, and
 * the database's partial unique index guarantees that two active appointments
 * can never share a date + start time (double-booking is impossible, even under
 * a race).
 */
import "server-only";
import { Prisma, type AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatMinutes } from "@/lib/format";
import { dateOnlyFromString, zonedNow } from "@/lib/time";
import { checkSlotBookable } from "./availability";
import { getBookingSettings } from "./content";
import { createNotification } from "./notifications";
import { recordAudit } from "./audit";
import { sendEmail } from "@/server/email/mailer";
import { appointmentStatusEmail } from "@/server/email/templates";
import type { BookingInput } from "@/validators/customer";

export type AppointmentDTO = Awaited<ReturnType<typeof mapAppointment>>;

const appointmentInclude = {
  service: {
    select: {
      id: true,
      name: true,
      slug: true,
      durationMinutes: true,
      startingPrice: true,
      currency: true,
      images: { orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }], take: 1, select: { url: true } },
    },
  },
  user: { select: { id: true, firstName: true, lastName: true, email: true, mobile: true, avatarUrl: true } },
  handledBy: { select: { id: true, firstName: true, lastName: true } },
  events: { orderBy: { createdAt: "asc" as const } },
  reviews: { select: { id: true, rating: true, isVisible: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

async function mapAppointment(appointment: AppointmentRow) {
  return {
    id: appointment.id,
    reference: appointment.reference,
    status: appointment.status,
    statusLabel: APPOINTMENT_STATUS_LABELS[appointment.status],
    date: appointment.date,
    dateLabel: formatDate(appointment.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    startMinutes: appointment.startMinutes,
    endMinutes: appointment.endMinutes,
    timeLabel: `${formatMinutes(appointment.startMinutes)} – ${formatMinutes(appointment.endMinutes)}`,
    durationMinutes: appointment.durationMinutes,
    customerNote: appointment.customerNote,
    adminNote: appointment.adminNote,
    quotedPrice: appointment.quotedPrice ? Number(appointment.quotedPrice) : null,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    completedAt: appointment.completedAt,
    cancelledAt: appointment.cancelledAt,
    service: {
      id: appointment.service.id,
      name: appointment.service.name,
      slug: appointment.service.slug,
      durationMinutes: appointment.service.durationMinutes,
      startingPrice: appointment.service.startingPrice ? Number(appointment.service.startingPrice) : null,
      currency: appointment.service.currency,
      image: appointment.service.images[0]?.url ?? null,
    },
    customer: {
      id: appointment.user.id,
      name: `${appointment.user.firstName} ${appointment.user.lastName}`.trim(),
      email: appointment.user.email,
      mobile: appointment.user.mobile,
      avatarUrl: appointment.user.avatarUrl,
    },
    handledBy: appointment.handledBy
      ? { id: appointment.handledBy.id, name: `${appointment.handledBy.firstName} ${appointment.handledBy.lastName}` }
      : null,
    events: appointment.events.map((event) => ({
      id: event.id,
      status: event.status,
      statusLabel: APPOINTMENT_STATUS_LABELS[event.status],
      note: event.note,
      createdAt: event.createdAt,
    })),
    review: appointment.reviews[0]
      ? { id: appointment.reviews[0].id, rating: appointment.reviews[0].rating, isVisible: appointment.reviews[0].isVisible }
      : null,
    canReview: appointment.status === "COMPLETED" && appointment.reviews.length === 0,
  };
}

/** Short, readable booking code: AUR-7K2QF4 */
async function generateReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let code = "";
    for (let index = 0; index < 6; index += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const reference = `AUR-${code}`;
    const exists = await prisma.appointment.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  return `AUR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/* -------------------------------------------------------------- creation */

export type BookingCreation =
  | { ok: true; appointment: AppointmentDTO }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createAppointment(userId: string, input: BookingInput): Promise<BookingCreation> {
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, deletedAt: null },
    select: { id: true, name: true, durationMinutes: true, isActive: true, isAvailable: true },
  });

  if (!service) return { ok: false, error: "That service is no longer available.", fieldErrors: { serviceId: ["Service not found."] } };
  if (!service.isActive) return { ok: false, error: "That service is no longer offered. Please choose another." };
  if (!service.isAvailable) {
    return { ok: false, error: "That service is temporarily unavailable. Please message the studio or choose another service." };
  }

  const date = dateOnlyFromString(input.date);
  if (!date) return { ok: false, error: "Please choose a valid date.", fieldErrors: { date: ["Invalid date."] } };

  const slot = await checkSlotBookable({ date, startMinutes: input.startMinutes, durationMinutes: service.durationMinutes });
  if (!slot.ok) return { ok: false, error: slot.error, fieldErrors: { startMinutes: [slot.error] } };

  const reference = await generateReference();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          reference,
          userId,
          serviceId: service.id,
          date,
          startMinutes: input.startMinutes,
          endMinutes: input.startMinutes + service.durationMinutes,
          durationMinutes: service.durationMinutes,
          status: "PENDING",
          customerNote: input.customerNote ? input.customerNote : null,
        },
        include: appointmentInclude,
      });

      await tx.appointmentEvent.create({
        data: {
          appointmentId: appointment.id,
          status: "PENDING",
          note: "Booking requested by the customer.",
          actorId: userId,
        },
      });

      await createNotification(
        {
          userId,
          type: "APPOINTMENT",
          title: "Appointment request received",
          message: `${service.name} on ${formatDate(date, { weekday: "long", day: "numeric", month: "long" })} at ${formatMinutes(
            input.startMinutes
          )}. We will confirm it shortly.`,
          link: "/appointments",
        },
        tx
      );

      return appointment;
    });

    const appointment = await mapAppointment(created);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const email = appointmentStatusEmail({
      customerName: appointment.customer.name,
      status: "PENDING",
      serviceName: appointment.service.name,
      date: appointment.date,
      startMinutes: appointment.startMinutes,
      reference: appointment.reference,
      appUrl,
    });
    await sendEmail({ to: appointment.customer.email, ...email });

    return { ok: true, appointment };
  } catch (error) {
    // The partial unique index is the final guard against double booking.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: "That time slot was just taken by another client. Please choose a different time.",
        fieldErrors: { startMinutes: ["That time slot is no longer available."] },
      };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[booking] failed:", message);
    return { ok: false, error: "We could not save your appointment. Please try again." };
  }
}

/* ---------------------------------------------------------- customer views */

export async function listCustomerAppointments(
  userId: string,
  options: { status?: AppointmentStatus | "UPCOMING" | "ALL"; page?: number; pageSize?: number } = {}
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.pageSize ?? 10;
  const { date: today } = zonedNow();
  const todayDate = dateOnlyFromString(today)!;

  const where: Prisma.AppointmentWhereInput = {
    userId,
    ...(options.status === "UPCOMING"
      ? { date: { gte: todayDate }, status: { in: ["PENDING", "CONFIRMED"] } }
      : options.status && options.status !== "ALL"
        ? { status: options.status }
        : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: [{ date: "desc" }, { startMinutes: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);

  return {
    items: await Promise.all(rows.map(mapAppointment)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAppointmentForCustomer(userId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, userId },
    include: appointmentInclude,
  });
  return appointment ? mapAppointment(appointment) : null;
}

export async function getNextAppointment(userId: string) {
  const { date } = zonedNow();
  const appointment = await prisma.appointment.findFirst({
    where: { userId, date: { gte: dateOnlyFromString(date)! }, status: { in: ["PENDING", "CONFIRMED"] } },
    include: appointmentInclude,
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
  });
  return appointment ? mapAppointment(appointment) : null;
}

export async function countCustomerAppointments(userId: string) {
  const { date } = zonedNow();
  const [total, upcoming, completed] = await Promise.all([
    prisma.appointment.count({ where: { userId } }),
    prisma.appointment.count({
      where: { userId, date: { gte: dateOnlyFromString(date)! }, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    prisma.appointment.count({ where: { userId, status: "COMPLETED" } }),
  ]);
  return { total, upcoming, completed };
}

export type CancelResult = { ok: true; message: string } | { ok: false; error: string };

/** Customers may cancel while the configured cancellation window is open. */
export async function cancelAppointmentByCustomer(
  userId: string,
  appointmentId: string,
  reason?: string
): Promise<CancelResult> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, userId },
    include: { service: { select: { name: true } } },
  });

  if (!appointment) return { ok: false, error: "Appointment not found." };

  if (appointment.status === "CANCELLED") return { ok: false, error: "This appointment is already cancelled." };
  if (appointment.status === "COMPLETED") return { ok: false, error: "Completed appointments cannot be cancelled." };
  if (appointment.status === "REJECTED") return { ok: false, error: "This request was already declined by the studio." };

  const settings = await getBookingSettings();
  const start = new Date(appointment.date.getTime() + appointment.startMinutes * 60 * 1000);
  const hoursUntil = (start.getTime() - Date.now()) / (60 * 60 * 1000);

  if (hoursUntil < settings.cancellationWindowHours) {
    return {
      ok: false,
      error: `Appointments must be cancelled at least ${settings.cancellationWindowHours} hours in advance. Please call the studio.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: userId,
        statusChangedAt: new Date(),
      },
    });
    await tx.appointmentEvent.create({
      data: { appointmentId, status: "CANCELLED", note: reason || "Cancelled by the customer.", actorId: userId },
    });
    await createNotification(
      {
        userId,
        type: "APPOINTMENT",
        title: "Appointment cancelled",
        message: `Your ${appointment.service.name} appointment on ${formatDate(appointment.date)} at ${formatMinutes(
          appointment.startMinutes
        )} was cancelled.`,
        link: "/appointments",
      },
      tx
    );
  });

  return { ok: true, message: "Your appointment has been cancelled." };
}

/* ------------------------------------------------------------- admin views */

export type AdminAppointmentFilters = {
  search?: string;
  status?: AppointmentStatus | "ALL";
  date?: string;
  serviceId?: string;
  page?: number;
  pageSize?: number;
};

export async function listAppointmentsForAdmin(filters: AdminAppointmentFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 15;
  const search = filters.search?.trim();
  const date = filters.date ? dateOnlyFromString(filters.date) : null;

  const where: Prisma.AppointmentWhereInput = {
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(date ? { date } : {}),
    ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" } },
            { user: { firstName: { contains: search, mode: "insensitive" } } },
            { user: { lastName: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { user: { mobile: { contains: search } } },
            { service: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total, statusCounts] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: [{ date: "desc" }, { startMinutes: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
    prisma.appointment.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return {
    items: await Promise.all(rows.map(mapAppointment)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])) as Record<
      AppointmentStatus,
      number
    >,
  };
}

export async function getAppointmentForAdmin(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: appointmentInclude,
  });
  return appointment ? mapAppointment(appointment) : null;
}

/** Which statuses an appointment may move to next. */
export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  REJECTED: ["CONFIRMED", "CANCELLED"],
  CANCELLED: ["CONFIRMED"],
  COMPLETED: [],
};

export type StatusChangeResult = { ok: true; message: string } | { ok: false; error: string };

export async function changeAppointmentStatus(
  adminId: string,
  input: { appointmentId: string; status: AppointmentStatus; adminNote?: string }
): Promise<StatusChangeResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: { service: { select: { name: true } }, user: { select: { id: true, firstName: true, email: true } } },
  });

  if (!appointment) return { ok: false, error: "Appointment not found." };

  const allowed = ALLOWED_TRANSITIONS[appointment.status];
  if (!allowed.includes(input.status)) {
    return {
      ok: false,
      error: `An appointment that is ${APPOINTMENT_STATUS_LABELS[appointment.status].toLowerCase()} cannot be marked as ${APPOINTMENT_STATUS_LABELS[
        input.status
      ].toLowerCase()}.`,
    };
  }

  // Re-activating (CONFIRMED) must not double-book the slot.
  if (input.status === "CONFIRMED") {
    const slot = await checkSlotBookable({
      date: appointment.date,
      startMinutes: appointment.startMinutes,
      durationMinutes: appointment.durationMinutes,
      ignoreAppointmentId: appointment.id,
    });
    if (!slot.ok) return { ok: false, error: slot.error };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: input.status,
        adminNote: input.adminNote ?? appointment.adminNote,
        statusChangedAt: now,
        handledById: adminId,
        completedAt: input.status === "COMPLETED" ? now : appointment.completedAt,
        cancelledAt: input.status === "CANCELLED" ? now : appointment.cancelledAt,
        cancelledById: input.status === "CANCELLED" ? adminId : appointment.cancelledById,
      },
    });

    await tx.appointmentEvent.create({
      data: {
        appointmentId: appointment.id,
        status: input.status,
        note: input.adminNote ?? null,
        actorId: adminId,
      },
    });

    const messages: Record<AppointmentStatus, string> = {
      PENDING: "Your appointment request is being reviewed.",
      CONFIRMED: `Your ${appointment.service.name} appointment on ${formatDate(
        appointment.date
      )} at ${formatMinutes(appointment.startMinutes)} is confirmed. We look forward to seeing you!`,
      COMPLETED: "Thank you for visiting Aurena Nails. We would love to hear your feedback.",
      CANCELLED: "Your appointment has been cancelled by the studio.",
      REJECTED: "Unfortunately the studio could not accept that appointment request.",
    };

    await createNotification(
      {
        userId: appointment.userId,
        type: "APPOINTMENT",
        title: `${APPOINTMENT_STATUS_LABELS[input.status]} — ${appointment.service.name}`,
        message: messages[input.status],
        link: "/appointments",
      },
      tx
    );
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const email = appointmentStatusEmail({
    customerName: appointment.user.firstName,
    status: input.status,
    serviceName: appointment.service.name,
    date: appointment.date,
    startMinutes: appointment.startMinutes,
    reference: appointment.reference,
    adminNote: input.adminNote ?? appointment.adminNote,
    appUrl,
  });
  await sendEmail({ to: appointment.user.email, ...email });

  await recordAudit({
    actorId: adminId,
    action: "appointment.status",
    entity: "Appointment",
    entityId: appointment.id,
    changes: { from: appointment.status, to: input.status, note: input.adminNote },
  });

  return { ok: true, message: `Appointment marked as ${APPOINTMENT_STATUS_LABELS[input.status].toLowerCase()}.` };
}

export async function updateAppointmentNote(adminId: string, appointmentId: string, adminNote: string) {
  await prisma.appointment.update({ where: { id: appointmentId }, data: { adminNote } });
  await recordAudit({
    actorId: adminId,
    action: "appointment.note",
    entity: "Appointment",
    entityId: appointmentId,
    changes: { adminNote },
  });
}

/** Aggregates for the dashboard. */
export async function appointmentStatusBreakdown() {
  const rows = await prisma.appointment.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = Object.fromEntries(rows.map((row) => [row.status, row._count._all])) as Record<string, number>;
  return {
    total: rows.reduce((sum, row) => sum + row._count._all, 0),
    pending: counts.PENDING ?? 0,
    confirmed: counts.CONFIRMED ?? 0,
    completed: counts.COMPLETED ?? 0,
    cancelled: counts.CANCELLED ?? 0,
    rejected: counts.REJECTED ?? 0,
  };
}

export async function upcomingAppointmentsForAdmin(take = 6) {
  const { date } = zonedNow();
  const rows = await prisma.appointment.findMany({
    where: { date: { gte: dateOnlyFromString(date)! }, status: { in: ["PENDING", "CONFIRMED"] } },
    include: appointmentInclude,
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    take,
  });
  return Promise.all(rows.map(mapAppointment));
}

/** "Has this customer completed the service?" — required to post a review. */
export async function hasCompletedAppointment(userId: string, serviceId: string) {
  const found = await prisma.appointment.findFirst({
    where: { userId, serviceId, status: "COMPLETED" },
    orderBy: { date: "desc" },
    select: { id: true, date: true },
  });
  return found;
}
