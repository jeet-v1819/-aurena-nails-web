"use client";

/**
 * General studio settings: identity and the booking rules that the engine uses
 * (slot interval, lead time, how far ahead clients may book, cancellation window).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { updateSettingsAction } from "@/server/actions/admin/content";
import { Alert, Divider } from "@/components/ui/primitives";
import { Field, FieldGrid } from "@/components/admin/form-fields";
import { notifyResult } from "@/components/ui/toaster";

export type SettingsValues = {
  siteName: string;
  tagline: string;
  seoDescription: string;
  footerNote: string;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
};

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setErrors({});

    const result = await updateSettingsAction(form);
    setBusy(false);

    if (!result.ok) {
      notifyResult(result);
      setError(result.error);
      setErrors(result.fieldErrors ?? {});
      return;
    }

    notifyResult(result);
    router.refresh();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <section className="card p-6">
        <h2 className="font-display text-xl">Studio identity</h2>
        <p className="mt-1 text-sm text-muted">
          These values are used in page titles, the footer and email templates.
        </p>

        <div className="mt-5 space-y-5">
          <FieldGrid>
            <Field label="Studio name" htmlFor="siteName" required error={errors.siteName?.[0]}>
              <input
                id="siteName"
                className="input"
                value={form.siteName}
                onChange={(event) => setForm({ ...form, siteName: event.target.value })}
              />
            </Field>
            <Field label="Tagline" htmlFor="tagline" required error={errors.tagline?.[0]}>
              <input
                id="tagline"
                className="input"
                value={form.tagline}
                onChange={(event) => setForm({ ...form, tagline: event.target.value })}
              />
            </Field>
          </FieldGrid>

          <Field
            label="Meta description"
            htmlFor="seoDescription"
            required
            hint="150–160 characters works best in search results."
            error={errors.seoDescription?.[0]}
          >
            <textarea
              id="seoDescription"
              className="textarea min-h-[90px]"
              value={form.seoDescription}
              onChange={(event) => setForm({ ...form, seoDescription: event.target.value })}
            />
          </Field>

          <Field label="Footer note" htmlFor="footerNote" hint="A short line under your opening hours.">
            <input
              id="footerNote"
              className="input"
              value={form.footerNote}
              onChange={(event) => setForm({ ...form, footerNote: event.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-xl">Booking rules</h2>
        <p className="mt-1 text-sm text-muted">
          Applied everywhere: the booking wizard, the availability API and the server-side validation.
        </p>

        <Divider className="my-5" />

        <FieldGrid columns={3}>
          <Field
            label="Slot interval (minutes)"
            htmlFor="slotIntervalMinutes"
            required
            hint="How often a start time is offered."
            error={errors.slotIntervalMinutes?.[0]}
          >
            <input
              id="slotIntervalMinutes"
              type="number"
              min={5}
              max={240}
              className="input"
              value={form.slotIntervalMinutes}
              onChange={(event) => setForm({ ...form, slotIntervalMinutes: Number(event.target.value) })}
            />
          </Field>

          <Field
            label="Minimum lead time (minutes)"
            htmlFor="minLeadMinutes"
            required
            hint="How soon before a slot bookings close."
            error={errors.minLeadMinutes?.[0]}
          >
            <input
              id="minLeadMinutes"
              type="number"
              min={0}
              max={10080}
              className="input"
              value={form.minLeadMinutes}
              onChange={(event) => setForm({ ...form, minLeadMinutes: Number(event.target.value) })}
            />
          </Field>

          <Field
            label="Book up to (days ahead)"
            htmlFor="maxAdvanceDays"
            required
            hint="How far into the future clients may book."
            error={errors.maxAdvanceDays?.[0]}
          >
            <input
              id="maxAdvanceDays"
              type="number"
              min={1}
              max={365}
              className="input"
              value={form.maxAdvanceDays}
              onChange={(event) => setForm({ ...form, maxAdvanceDays: Number(event.target.value) })}
            />
          </Field>
        </FieldGrid>

        <div className="mt-5">
          <FieldGrid>
            <Field
              label="Cancellation window (hours)"
              htmlFor="cancellationWindowHours"
              required
              hint="Clients can cancel free of charge until this point. Use 0 to allow cancellation any time."
              error={errors.cancellationWindowHours?.[0]}
            >
              <input
                id="cancellationWindowHours"
                type="number"
                min={0}
                max={720}
                className="input"
                value={form.cancellationWindowHours}
                onChange={(event) => setForm({ ...form, cancellationWindowHours: Number(event.target.value) })}
              />
            </Field>
          </FieldGrid>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {busy ? "Saving…" : "Save settings"}
        </button>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck size={13} className="text-rosegold" />
          Only administrators can change these values.
        </p>
      </div>
    </form>
  );
}
