import Link from "next/link";
import { Star } from "lucide-react";
import { listReviewsForAdmin, reviewStats } from "@/server/services/reviews";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ReviewActions } from "@/components/admin/review-actions";
import { Badge, EmptyState, Pagination, StarRating } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { parsePage } from "@/lib/utils";

export const metadata = { title: "Reviews · Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AdminReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const visibilityParam = single(params.visibility);
  const visibility = visibilityParam === "visible" || visibilityParam === "hidden" ? visibilityParam : "all";
  const ratingParam = Number(single(params.rating));

  const [reviews, stats] = await Promise.all([
    listReviewsForAdmin({
      search: single(params.q),
      visibility,
      rating: Number.isFinite(ratingParam) && ratingParam >= 1 && ratingParam <= 5 ? ratingParam : undefined,
      page: parsePage(single(params.page)),
      pageSize: 15,
    }),
    reviewStats(),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="Reviews"
        description="Verified feedback from customers who completed an appointment. Hide anything inappropriate, keep a private note of the reason, and the service rating updates itself."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="font-display text-2xl">{stats.total}</p>
          <p className="mt-1 text-sm text-muted">Total reviews</p>
        </div>
        <div className="card p-4">
          <p className="font-display text-2xl">{stats.average ? stats.average.toFixed(2) : "—"}</p>
          <p className="mt-1 text-sm text-muted">Average rating</p>
        </div>
        <div className="card p-4">
          <p className="font-display text-2xl">{stats.hidden}</p>
          <p className="mt-1 text-sm text-muted">Hidden from the site</p>
        </div>
      </div>

      <form method="get" className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0">
          <span className="sr-only">Search reviews</span>
          <input name="q" defaultValue={single(params.q) ?? ""} placeholder="Search text, customer, service…" className="input" />
        </label>
        <label className="min-w-0">
          <span className="sr-only">Filter by rating</span>
          <select name="rating" defaultValue={single(params.rating) ?? ""} className="select">
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star{value === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Filter by visibility</span>
          <select name="visibility" defaultValue={visibility === "all" ? "" : visibility} className="select">
            <option value="">All reviews</option>
            <option value="visible">Visible only</option>
            <option value="hidden">Hidden only</option>
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Apply filters
        </button>
      </form>

      <div className="mt-6">
        {reviews.items.length ? (
          <>
            <ul className="space-y-4">
              {reviews.items.map((review) => (
                <li key={review.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{review.customer.name}</p>
                        {review.isVisible ? <Badge tone="success">Visible</Badge> : <Badge tone="warning">Hidden</Badge>}
                        {review.appointmentId ? <Badge tone="muted">Verified visit</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        <Link href={`/services/${review.service.slug}`} className="hover:text-charcoal">
                          {review.service.name}
                        </Link>{" "}
                        · {formatDate(review.createdAt)}
                      </p>
                    </div>

                    <ReviewActions
                      reviewId={review.id}
                      isVisible={review.isVisible}
                      adminNote={review.adminNote}
                      customerName={review.customer.name}
                      serviceName={review.service.name}
                    />
                  </div>

                  <div className="mt-3">
                    <StarRating value={review.rating} />
                  </div>

                  {review.comment ? (
                    <p className="mt-3 text-sm leading-relaxed text-charcoal-soft">{review.comment}</p>
                  ) : (
                    <p className="mt-3 text-sm italic text-muted">No comment left.</p>
                  )}

                  {review.adminNote ? (
                    <p className="mt-3 rounded-xl bg-cream-deep p-3 text-xs text-muted">
                      <span className="font-medium text-charcoal-soft">Internal note: </span>
                      {review.adminNote}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>

            <Pagination
              page={reviews.page}
              totalPages={reviews.totalPages}
              basePath="/admin/reviews"
              searchParams={{
                q: single(params.q),
                rating: single(params.rating),
                visibility: visibility === "all" ? undefined : visibility,
              }}
            />
          </>
        ) : (
          <EmptyState
            icon={<Star size={26} />}
            title="No reviews match those filters"
            description="Reviews appear here once a customer completes an appointment and writes about it."
            action={{ href: "/admin/reviews", label: "Show all reviews" }}
          />
        )}
      </div>
    </div>
  );
}
