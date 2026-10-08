/**
 * Admin dashboard statistics and chart series.
 */
import "server-only";
import { prisma } from "@/lib/db/prisma";
import { todayDateOnly } from "@/lib/time";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKeys(count: number) {
  const now = new Date();
  const keys: Array<{ key: string; label: string; start: Date; end: Date }> = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    keys.push({
      key: `${start.getUTCFullYear()}-${start.getUTCMonth() + 1}`,
      label: `${MONTH_LABELS[start.getUTCMonth()]} ${String(start.getUTCFullYear()).slice(2)}`,
      start,
      end,
    });
  }

  return keys;
}

export async function getDashboardStats() {
  const today = todayDateOnly();

  const [
    customerTotal,
    customerActive,
    customerInactive,
    newCustomersThisMonth,
    serviceTotal,
    serviceActive,
    serviceFeatured,
    galleryTotal,
    galleryActive,
    videoTotal,
    videoActive,
    appointmentTotal,
    appointmentPending,
    appointmentConfirmed,
    appointmentCompleted,
    appointmentCancelled,
    appointmentRejected,
    appointmentsToday,
    upcomingAppointments,
    reviewTotal,
    hiddenReviews,
    reviewAggregate,
    unreadMessages,
    totalMessages,
    holidaysUpcoming,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null, isActive: true } }),
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null, isActive: false } }),
    prisma.user.count({
      where: { role: "CUSTOMER", deletedAt: null, createdAt: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)) } },
    }),
    prisma.service.count({ where: { deletedAt: null } }),
    prisma.service.count({ where: { deletedAt: null, isActive: true } }),
    prisma.service.count({ where: { deletedAt: null, isFeatured: true } }),
    prisma.galleryImage.count({ where: { deletedAt: null } }),
    prisma.galleryImage.count({ where: { deletedAt: null, isActive: true } }),
    prisma.video.count({ where: { deletedAt: null } }),
    prisma.video.count({ where: { deletedAt: null, isActive: true } }),
    prisma.appointment.count(),
    prisma.appointment.count({ where: { status: "PENDING" } }),
    prisma.appointment.count({ where: { status: "CONFIRMED" } }),
    prisma.appointment.count({ where: { status: "COMPLETED" } }),
    prisma.appointment.count({ where: { status: "CANCELLED" } }),
    prisma.appointment.count({ where: { status: "REJECTED" } }),
    prisma.appointment.count({ where: { date: today } }),
    prisma.appointment.count({ where: { date: { gte: today }, status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.review.count(),
    prisma.review.count({ where: { isVisible: false } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.contactMessage.count(),
    prisma.holiday.count({ where: { date: { gte: today }, isActive: true } }),
  ]);

  return {
    customers: {
      total: customerTotal,
      active: customerActive,
      inactive: customerInactive,
      newThisMonth: newCustomersThisMonth,
    },
    services: { total: serviceTotal, active: serviceActive, featured: serviceFeatured },
    gallery: { total: galleryTotal, active: galleryActive },
    videos: { total: videoTotal, active: videoActive },
    appointments: {
      total: appointmentTotal,
      pending: appointmentPending,
      confirmed: appointmentConfirmed,
      completed: appointmentCompleted,
      cancelled: appointmentCancelled,
      rejected: appointmentRejected,
      today: appointmentsToday,
      upcoming: upcomingAppointments,
      revenueFree: true, // explicitly not a commerce dashboard
    },
    reviews: {
      total: reviewTotal,
      hidden: hiddenReviews,
      average: Number((reviewAggregate._avg.rating ?? 0).toFixed(2)),
    },
    messages: { unread: unreadMessages, total: totalMessages },
    holidays: { upcoming: holidaysUpcoming },
  };
}

/** Appointments + new customers per month, for the dashboard charts. */
export async function getMonthlyActivity(months = 6) {
  const keys = monthKeys(months);
  const rangeStart = keys[0].start;

  const [appointments, customers] = await Promise.all([
    prisma.appointment.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true, status: true },
    }),
    prisma.user.findMany({
      where: { role: "CUSTOMER", createdAt: { gte: rangeStart }, deletedAt: null },
      select: { createdAt: true },
    }),
  ]);

  return keys.map(({ key, label, start, end }) => {
    const inMonth = appointments.filter(
      (appointment) => appointment.createdAt >= start && appointment.createdAt < end
    );
    return {
      month: label,
      key,
      appointments: inMonth.length,
      confirmed: inMonth.filter((appointment) => appointment.status === "CONFIRMED").length,
      completed: inMonth.filter((appointment) => appointment.status === "COMPLETED").length,
      cancelled: inMonth.filter((appointment) => appointment.status === "CANCELLED").length,
      customers: customers.filter((customer) => customer.createdAt >= start && customer.createdAt < end).length,
    };
  });
}

/** Top services by appointment volume. */
export async function getPopularServices(take = 5) {
  const grouped = await prisma.appointment.groupBy({
    by: ["serviceId"],
    _count: { _all: true },
    orderBy: { _count: { serviceId: "desc" } },
    take,
  });

  if (!grouped.length) return [];

  const services = await prisma.service.findMany({
    where: { id: { in: grouped.map((row) => row.serviceId) } },
    select: { id: true, name: true, ratingAverage: true },
  });

  return grouped
    .map((row) => {
      const service = services.find((candidate) => candidate.id === row.serviceId);
      return {
        name: service?.name ?? "Unknown service",
        appointments: row._count._all,
        rating: service ? Number(service.ratingAverage) : 0,
      };
    })
    .sort((a, b) => b.appointments - a.appointments);
}

export async function getRecentActivity(take = 5) {
  const [appointments, messages, reviews, customers] = await Promise.all([
    prisma.appointment.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        reference: true,
        status: true,
        date: true,
        startMinutes: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    }),
    prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, name: true, subject: true, isRead: true, createdAt: true },
    }),
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        rating: true,
        createdAt: true,
        isVisible: true,
        user: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "CUSTOMER", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
    }),
  ]);

  return { appointments, messages, reviews, customers };
}
