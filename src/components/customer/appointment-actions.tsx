"use client";

/**
 * Appointment controls for the customer: cancel a booking (with confirmation)
 * and write, edit or delete the review once the appointment is completed.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Star, Trash2, XCircle } from "lucide-react";
import { cancelBookingAction, createReviewAction } from "@/server/actions/booking";
import { deleteReviewAction, updateReviewAction } from "@/server/actions/customer";
import { ConfirmDialog, Modal } from "@/components/ui/interactive";
import { notifyResult } from "@/components/ui/toaster";
import { StarRating } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Review = { id: string; rating: number; isVisible: boolean; comment?: string | null } | null;

export function AppointmentActions({
  appointmentId,
  serviceId,
  serviceName,
  reference,
  status,
  canCancel,
  canReview,
  review,
  reviewComment,
}: {
  appointmentId: string;
  serviceId: string;
  serviceName: string;
  reference: string;
  status: string;
  canCancel: boolean;
  canReview: boolean;
  review: Review;
  reviewComment?: string | null;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [rating, setRating] = useState(review?.rating ?? 5);
  const [comment, setComment] = useState(reviewComment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    const result = await cancelBookingAction({ appointmentId, reason: "" });
    notifyResult(result);
    setConfirmOpen(false);
    if (result.ok) router.refresh();
  };

  const submitReview = async () => {
    setError(null);
    setBusy(true);

    const result = review
      ? await updateReviewAction({ reviewId: review.id, rating, comment })
      : await createReviewAction({ serviceId, rating, comment });

    setBusy(false);

    if (!result.ok) {
      notifyResult(result);
      setError(result.error);
      return;
    }

    notifyResult(result);
    setReviewOpen(false);
    router.refresh();
  };

  const removeReview = async () => {
    if (!review) return;
    setDeleting(true);
    const result = await deleteReviewAction({ reviewId: review.id });
    setDeleting(false);
    notifyResult(result);
    if (result.ok) router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCancel ? (
        <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => setConfirmOpen(true)}>
          <XCircle size={15} /> Cancel booking
        </button>
      ) : null}

      {canReview || review ? (
        <button
          type="button"
          className={cn("btn-sm", review ? "btn-outline" : "btn-rose")}
          onClick={() => {
            setRating(review?.rating ?? 5);
            setComment(reviewComment ?? "");
            setError(null);
            setReviewOpen(true);
          }}
        >
          {review ? <Pencil size={15} /> : <Star size={15} />}
          {review ? (review.isVisible ? "Edit my review" : "Edit hidden review") : "Write a review"}
        </button>
      ) : null}

      {review ? (
        <button type="button" className="btn-ghost btn-sm text-muted" onClick={removeReview} disabled={deleting}>
          <Trash2 size={15} /> {deleting ? "Removing…" : "Delete review"}
        </button>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Cancel this appointment?"
        message={`Are you sure you want to cancel ${serviceName} (${reference})? The slot is released for other clients and the studio is notified.`}
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep my booking"
        onConfirm={cancel}
        onClose={() => setConfirmOpen(false)}
      />

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={review ? "Edit your review" : "How was your visit?"}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setReviewOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={submitReview} disabled={busy}>
              {busy ? "Saving…" : review ? "Save changes" : "Publish review"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <p className="text-sm text-muted">
            Your review appears on the {serviceName} page once saved. Reviews are public, so please keep them kind and
            honest.
          </p>

          {error ? <p className="field-error">{error}</p> : null}

          <div>
            <span className="label">Your rating</span>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    onClick={() => setRating(value)}
                    className="p-0.5"
                  >
                    <Star
                      size={26}
                      className={value <= rating ? "fill-rosegold text-rosegold" : "text-nude-dark"}
                    />
                  </button>
                ))}
              </div>
              <span className="text-sm text-muted">{rating}/5</span>
            </div>
          </div>

          <div>
            <label htmlFor="review-comment" className="label">
              Your review
            </label>
            <textarea
              id="review-comment"
              className="textarea mt-2 min-h-[130px]"
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Tell others about the design, the finish and how your visit felt."
            />
            <p className="mt-1 text-right text-xs text-muted">{comment.length}/1000</p>
          </div>

          {status === "COMPLETED" ? (
            <div className="rounded-xl bg-cream-deep p-4 text-xs text-muted">
              <StarRating value={rating} showValue={false} size={14} />
              <p className="mt-2">Reviews can be edited or removed at any time from this page.</p>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
