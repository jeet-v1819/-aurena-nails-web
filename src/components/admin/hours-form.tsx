"use client";

/**
 * Opening hours for the week. These values drive the booking engine: slots are
 * only ever offered inside an open window, and breaks are subtracted.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { updateBusinessHoursAction } from "@/server/actions/admin/content";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { DEFAULT_SLOT_INTERVAL_MINUTES } from "@/lib/constants";

type DayDraft = {
  dayOfWeek: number;
  dayName: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStartTime: string;
  breakEndTime: string;
  slotIntervalMinutes: string;
  note: string;
};

export function HoursForm({ days }: { days: DayDraft[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(days);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (dayOfWeek: number, patch: Partial<DayDraft>) =>
    setDraft((current) => current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)));

  const save = async () => {
    setBusy(true);
    setError(null);

    const result = await updateBusinessHoursAction({ days: draft });
    setBusy(false);
    notifyResult(result);
    if (result.ok) router.refresh();
    else setError(result.error);
  };

  return (
    <div className="space-y-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <ul className="space-y-3">
        {draft.map((day) => (
          <li key={day.dayOfWeek} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-rosegold)]"
                  checked={day.isOpen}
                  onChange={(event) => update(day.dayOfWeek, { isOpen: event.target.checked })}
                />
                <span className="font-medium">{day.dayName}</span>
                <span className="text-xs text-muted">{day.isOpen ? "Open" : "Closed"}</span>
              </label>

              {day.isOpen ? (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-0">
                    <span className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">Opens</span>
                    <input
                      type="time"
                      className="input mt-1 w-32"
                      value={day.openTime}
                      onChange={(event) => update(day.dayOfWeek, { openTime: event.target.value })}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">Closes</span>
                    <input
                      type="time"
                      className="input mt-1 w-32"
                      value={day.closeTime}
                      onChange={(event) => update(day.dayOfWeek, { closeTime: event.target.value })}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">Break from</span>
                    <input
                      type="time"
                      className="input mt-1 w-32"
                      value={day.breakStartTime}
                      onChange={(event) => update(day.dayOfWeek, { breakStartTime: event.target.value })}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">to</span>
                    <input
                      type="time"
                      className="input mt-1 w-32"
                      value={day.breakEndTime}
                      onChange={(event) => update(day.dayOfWeek, { breakEndTime: event.target.value })}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">Slot every (min)</span>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      className="input mt-1 w-28"
                      value={day.slotIntervalMinutes}
                      onChange={(event) => update(day.dayOfWeek, { slotIntervalMinutes: event.target.value })}
                      placeholder={String(DEFAULT_SLOT_INTERVAL_MINUTES)}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-xs text-muted">The studio is closed — no slots are offered on {day.dayName}s.</p>
              )}
            </div>

            {day.isOpen ? (
              <label className="mt-3 block">
                <span className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">Public note (optional)</span>
                <input
                  className="input mt-1"
                  value={day.note}
                  onChange={(event) => update(day.dayOfWeek, { note: event.target.value })}
                  placeholder="Last booking 45 minutes before closing"
                />
              </label>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 p-4 backdrop-blur">
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {busy ? "Saving…" : "Save opening hours"}
        </button>
        <p className="text-xs text-muted">
          Leave the slot interval blank to use the studio default of {DEFAULT_SLOT_INTERVAL_MINUTES} minutes.
        </p>
      </div>
    </div>
  );
}
