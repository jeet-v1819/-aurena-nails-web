/**
 * Reviews & ratings.
 *
 * Business rules
 *  * only a customer with a COMPLETED appointment for that service may review it
 *  * one review per customer per service (editable afterwards)
 *  * customers may edit/delete their own review; admins may *hide* or delete but
 *    never silently rewrite a customer's words — moderation is recorded in the
 *    audit log
 *  * the service rating shown on the website is recalculated from visible reviews
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "./audit";
import { hasCompletedAppointment } from "./bookings";
import type { ReviewInput } from "@/validators/customer";

export type ReviewDTO = {
  id: string;
  rating: number;
  comment: string | null;
  isVisible: boolean;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: string; name: string; avatarUrl: string | null };
  service: { id: string; name: string; slug: string };
  appointmentId: string | null;
};

const reviewInclude = {
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  service: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ReviewInclude;

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

function toReviewDTO(review: ReviewRow): ReviewDTO {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    isVisible: review.isVisible,
    adminNote: review.adminNote,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    customer: {
      id: review.user.id,
      name: `${review.user.firstName} ${review.user.lastName?.[0] ?? ""}`.trim(),
      avatarUrl: review.user.avatarUrl,
    },
    service: review.service,
    appointmentId: review.appointmentId,
  };
}

/** Recalculates the cached rating aggregates for one service. */
export async function recalculateServiceRating(serviceId: string) {
  const aggregate = await prisma.review.aggregate({
    where: { serviceId, isVisible: true },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      ratingAverage: Number((aggregate._avg.rating ?? 0).toFixed(2)),
      ratingCount: aggregate._count._all,
    },
  });
}

/** Eligibility check used by the review form. */
export async function getReviewEligibility(userId: string, serviceId: string) {
  const [completed, existing] = await Promise.all([
    hasCompletedAppointment(userId, serviceId),
    prisma.review.findFirst({ where: { userId, serviceId }, select: { id: true, rating: true, comment: true } }),
  ]);

  return {
    canReview: Boolean(completed) && !existing,
    canEdit: Boolean(existing),
    existing,
    completedAppointment: completed,
  };
}

export type ReviewWriteResult =
  | { ok: true; review: ReviewDTO; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createReview(userId: string, input: ReviewInput): Promise<ReviewWriteResult> {
  const appointment = await hasCompletedAppointment(userId, input.serviceId);

  if (!appointment) {
    return {
      ok: false,
      error: "Reviews can be written after a completed appointment for this service.",
      fieldErrors: { serviceId: ["You can review this service after your visit."] },
    };
  }

  const existing = await prisma.review.findFirst({ where: { userId, serviceId: input.serviceId }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "You have already reviewed this service — you can edit your review instead." };
  }

  const review = await prisma.review.create({
    data: {
      userId,
      serviceId: input.serviceId,
      appointmentId: appointment.id,
      rating: input.rating,
      comment: input.comment,
    },
    include: reviewInclude,
  });

  await recalculateServiceRating(input.serviceId);

  const service = await prisma.service.findUnique({ where: { id: input.serviceId }, select: { name: true } });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      prisma.notification.create({
        data: {
          userId: admin.id,
          type: "REVIEW",
          title: "New review received",
          message: `${input.rating}-star review for ${service?.name ?? "a service"}.`,
          link: "/admin/reviews",
        },
      })
    )
  );

  return { ok: true, review: toReviewDTO(review), message: "Thank you! Your review has been published." };
}

export async function updateOwnReview(
  userId: string,
  reviewId: string,
  input: { rating: number; comment: string }
): Promise<ReviewWriteResult> {
  const existing = await prisma.review.findFirst({ where: { id: reviewId, userId } });
  if (!existing) return { ok: false, error: "Review not found." };

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { rating: input.rating, comment: input.comment },
    include: reviewInclude,
  });

  await recalculateServiceRating(review.serviceId);
  return { ok: true, review: toReviewDTO(review), message: "Your review has been updated." };
}

export async function deleteOwnReview(userId: string, reviewId: string) {
  const existing = await prisma.review.findFirst({ where: { id: reviewId, userId }, select: { serviceId: true } });
  if (!existing) return { ok: false as const, error: "Review not found." };

  await prisma.review.delete({ where: { id: reviewId } });
  await recalculateServiceRating(existing.serviceId);
  return { ok: true as const, message: "Your review has been removed." };
}

/* ------------------------------------------------------------- public read */

export async function listServiceReviews(
  serviceId: string,
  options: { page?: number; pageSize?: number; includeHidden?: boolean } = {}
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.pageSize ?? 6;

  const where: Prisma.ReviewWhereInput = {
    serviceId,
    ...(options.includeHidden ? {} : { isVisible: true }),
  };

  const [rows, total, distribution] = await Promise.all([
    prisma.review.findMany({
      where,
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
  ]);

  return {
    items: rows.map(toReviewDTO),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    distribution: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: distribution.find((row) => row.rating === rating)?._count._all ?? 0,
    })),
  };
}

export async function listCustomerReviews(userId: string) {
  const rows = await prisma.review.findMany({
    where: { userId },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toReviewDTO);
}

/* ------------------------------------------------------------------ admin */

export type AdminReviewFilters = {
  search?: string;
  rating?: number;
  visibility?: "all" | "visible" | "hidden";
  page?: number;
  pageSize?: number;
};

export async function listReviewsForAdmin(filters: AdminReviewFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 15;
  const search = filters.search?.trim();

  const where: Prisma.ReviewWhereInput = {
    ...(filters.rating ? { rating: filters.rating } : {}),
    ...(filters.visibility === "visible" ? { isVisible: true } : {}),
    ...(filters.visibility === "hidden" ? { isVisible: false } : {}),
    ...(search
      ? {
          OR: [
            { comment: { contains: search, mode: "insensitive" } },
            { user: { firstName: { contains: search, mode: "insensitive" } } },
            { user: { lastName: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { service: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total, aggregate] = await Promise.all([
    prisma.review.findMany({
      where,
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
  ]);

  return {
    items: rows.map(toReviewDTO),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    averageRating: Number((aggregate._avg.rating ?? 0).toFixed(2)),
  };
}

export async function moderateReview(
  adminId: string,
  input: { reviewId: string; action: "hide" | "show" | "delete" | "note"; adminNote?: string }
) {
  const review = await prisma.review.findUnique({
    where: { id: input.reviewId },
    select: { id: true, serviceId: true, isVisible: true, rating: true, comment: true },
  });
  if (!review) return { ok: false as const, error: "Review not found." };

  if (input.action === "delete") {
    await prisma.review.delete({ where: { id: review.id } });
    await recordAudit({
      actorId: adminId,
      action: "review.delete",
      entity: "Review",
      entityId: review.id,
      changes: { rating: review.rating, comment: review.comment },
    });
    await recalculateServiceRating(review.serviceId);
    return { ok: true as const, message: "Review deleted." };
  }

  const isVisible = input.action === "hide" ? false : input.action === "show" ? true : review.isVisible;

  await prisma.review.update({
    where: { id: review.id },
    data: {
      isVisible,
      hiddenAt: isVisible ? null : new Date(),
      adminNote: input.adminNote ?? undefined,
    },
  });

  await recordAudit({
    actorId: adminId,
    action: input.action === "note" ? "review.note" : isVisible ? "review.show" : "review.hide",
    entity: "Review",
    entityId: review.id,
    changes: { adminNote: input.adminNote ?? null, isVisible },
  });

  await recalculateServiceRating(review.serviceId);

  const messages = {
    hide: "Review hidden from the website.",
    show: "Review is visible again.",
    note: "Admin note saved.",
  } as const;

  return { ok: true as const, message: messages[input.action] ?? "Review updated." };
}

export async function reviewStats() {
  const [total, hidden, aggregate] = await Promise.all([
    prisma.review.count(),
    prisma.review.count({ where: { isVisible: false } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
  ]);
  return { total, hidden, average: Number((aggregate._avg.rating ?? 0).toFixed(2)) };
}
