"use client";

/** Holidays and one-off closures: create, edit and delete blocked dates. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, CalendarPlus, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  createHolidayAction,
  deleteHolidayAction,
  updateHolidayAction,
} from "@/server/actions/admin/content";
import { ConfirmDialog, Modal } from "@/components/ui/interactive";
import { Alert, Badge } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { formatLongDate } from "@/lib/format";

export type HolidayRow = {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  isActive: boolean;
};

const EMPTY = { name: "", date: "", description: "", isActive: true };

export function HolidayManager({ holidays }: { holidays: HolidayRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HolidayRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setForm({ ...EMPTY });
    setEditingId(null);
    setError(null);
    setOpen(true);
  };

  const openEdit = (holiday: HolidayRow) => {
    setForm({
      name: holiday.name,
      date: new Date(holiday.date).toISOString().slice(0, 10),
      description: holiday.description ?? "",
      isActive: holiday.isActive,
    });
    setEditingId(holiday.id);
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);

    const result = editingId
      ? await updateHolidayAction({ holidayId: editingId, ...form })
      : await createHolidayAction(form);

    setBusy(false);

    if (!result.ok) {
      notifyResult(result);
      setError(result.error);
      return;
    }

    notifyResult(result);
    setOpen(false);
    router.refresh();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteHolidayAction({ holidayId: deleteTarget.id });
    setBusy(false);
    notifyResult(result);
    setDeleteTarget(null);
    if (result.ok) router.refresh();
  };

  const today = new Date();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Blocked dates appear as closed in the booking calendar — clients cannot request them.
        </p>
        <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
          <CalendarPlus size={15} /> Add holiday
        </button>
      </div>

      <ul className="mt-6 space-y-3">
        {holidays.map((holiday) => {
          const isPast = new Date(holiday.date) < today;

          return (
            <li key={holiday.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg">{holiday.name}</h2>
                  {holiday.isActive ? (
                    <Badge tone="rose">Blocked</Badge>
                  ) : (
                    <Badge tone="muted">Not blocking</Badge>
                  )}
                  {isPast ? <Badge tone="muted">Past</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted">{formatLongDate(holiday.date)}</p>
                {holiday.description ? (
                  <p className="mt-1 text-xs text-muted">{holiday.description}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button type="button" className="btn-outline btn-sm" onClick={() => openEdit(holiday)}>
                  <Pencil size={14} /> Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm text-danger"
                  onClick={() => setDeleteTarget(holiday)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </li>
          );
        })}

        {!holidays.length ? (
          <li className="card flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blush text-rosegold">
              <CalendarOff size={20} />
            </span>
            <p className="text-sm text-muted">
              No holidays or closures yet. Add festivals, staff leave or renovation days here.
            </p>
          </li>
        ) : null}
      </ul>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit holiday" : "Add a holiday"}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} {editingId ? "Save changes" : "Add holiday"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <label className="block">
            <span className="label">Name</span>
            <input
              className="input mt-2"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Diwali — studio closed"
            />
          </label>

          <label className="block">
            <span className="label">Date</span>
            <input
              type="date"
              className="input mt-2"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </label>

          <label className="block">
            <span className="label">Description (optional)</span>
            <textarea
              className="textarea mt-2 min-h-[80px]"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="We reopen the next morning at 10:00."
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-rosegold)]"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Block this date for bookings
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this holiday?"
        message={`“${deleteTarget?.name ?? ""}” will no longer block bookings. This cannot be undone.`}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
