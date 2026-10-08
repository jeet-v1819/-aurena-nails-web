"use client";

/**
 * Admin controls for one appointment: move it through its allowed statuses
 * (confirm, complete, reject, cancel) and leave an internal note that the
 * customer sees on their appointments page.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, MessageSquare, X } from "lucide-react";
import { updateAppointmentNoteAction, updateAppointmentStatusAction } from "@/server/actions/admin/people";
import { Modal } from "@/components/ui/interactive";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TRANSITIONS: Record<string, Array<"PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "REJECTED">> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  REJECTED: ["CONFIRMED", "CANCELLED"],
  CANCELLED: ["CONFIRMED"],
  COMPLETED: [],
};

export function AppointmentActions({
  appointmentId,
  reference,
  status,
  adminNote,
  customerName,
}: {
  appointmentId: string;
  reference: string;
  status: string;
  adminNote: string | null;
  customerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState(adminNote ?? "");
  const [error, setError] = useState<string | null>(null);

  const options = TRANSITIONS[status] ?? [];

  const changeStatus = async (next: string) => {
    setBusy(next);
    setError(null);

    const result = await updateAppointmentStatusAction({ appointmentId, status: next, adminNote: note });

    setBusy(null);
    notifyResult(result);

    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const saveNote = async () => {
    setBusy("note");
    const result = await updateAppointmentNoteAction({ appointmentId, adminNote: note });
    setBusy(null);
    notifyResult(result);
    if (result.ok) {
      setNoteOpen(false);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        className="btn-ghost btn-sm text-muted"
        onClick={() => setNoteOpen(true)}
        aria-label={`Note for ${reference}`}
      >
        <MessageSquare size={15} /> {adminNote ? "Edit note" : "Add note"}
      </button>

      {options.length ? (
        <div className="relative">
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            Update status <ChevronDown size={14} />
          </button>

          {open ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-card)]"
              >
                {options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="menuitem"
                    disabled={busy === option}
                    onClick={() => changeStatus(option)}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-cream-deep",
                      option === "CANCELLED" || option === "REJECTED" ? "text-danger" : "text-charcoal-soft"
                    )}
                  >
                    {busy === option ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Mark as {APPOINTMENT_STATUS_LABELS[option].toLowerCase()}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <span className="text-xs text-muted">No further transitions</span>
      )}

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={`Note for ${customerName}`}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setNoteOpen(false)} disabled={busy === "note"}>
              <X size={15} /> Cancel
            </button>
            <button type="button" className="btn-primary" onClick={saveNote} disabled={busy === "note"}>
              {busy === "note" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save note
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">
          This note is shown to the customer on their appointments page — keep it warm and specific (for example design
          suggestions or after-care reminders).
        </p>
        <textarea
          className="textarea mt-4 min-h-[130px]"
          maxLength={600}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Please arrive with clean nails — we will start with a consultation."
        />
        <p className="mt-1 text-right text-xs text-muted">{note.length}/600</p>
      </Modal>

      {error ? (
        <div className="w-full">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}
