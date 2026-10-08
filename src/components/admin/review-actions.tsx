"use client";

/** Moderation controls for a review: hide/show, save an internal note, delete. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, StickyNote, Trash2 } from "lucide-react";
import { moderateReviewAction } from "@/server/actions/admin/people";
import { ConfirmDialog, Modal } from "@/components/ui/interactive";
import { notifyResult } from "@/components/ui/toaster";

export function ReviewActions({
  reviewId,
  isVisible,
  adminNote,
  customerName,
  serviceName,
}: {
  reviewId: string;
  isVisible: boolean;
  adminNote: string | null;
  customerName: string;
  serviceName: string;
}) {
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [note, setNote] = useState(adminNote ?? "");
  const [busy, setBusy] = useState(false);

  const moderate = async (action: "hide" | "show" | "note") => {
    setBusy(true);
    const result = await moderateReviewAction({ reviewId, action, adminNote: note });
    setBusy(false);
    notifyResult(result);
    if (result.ok) {
      setNoteOpen(false);
      router.refresh();
    }
  };

  const remove = async () => {
    setBusy(true);
    const result = await moderateReviewAction({ reviewId, action: "delete" });
    setBusy(false);
    notifyResult(result);
    setDeleteOpen(false);
    if (result.ok) router.refresh();
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-charcoal"
        aria-label={isVisible ? "Hide review" : "Show review"}
        disabled={busy}
        onClick={() => moderate(isVisible ? "hide" : "show")}
      >
        {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>

      <button
        type="button"
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-charcoal"
        aria-label="Moderation note"
        onClick={() => setNoteOpen(true)}
      >
        <StickyNote size={15} />
      </button>

      <button
        type="button"
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-danger"
        aria-label="Delete review"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 size={15} />
      </button>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Internal moderation note"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setNoteOpen(false)} disabled={busy}>
              Close
            </button>
            <button type="button" className="btn-primary" onClick={() => moderate("note")} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} Save note
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Only the studio can see this note. Use it to record why a review was hidden, or what you agreed with the
          client.
        </p>
        <textarea
          className="textarea mt-4 min-h-[120px]"
          maxLength={400}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={`Context for ${customerName}'s review of ${serviceName}…`}
        />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this review?"
        message={`${customerName}'s review of ${serviceName} will be permanently removed and the service rating recalculated. This cannot be undone — hiding it keeps the record instead.`}
        confirmLabel="Yes, delete review"
        cancelLabel="Cancel"
        onConfirm={remove}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
