"use client";

/**
 * The five-step booking wizard: service → date → time → note → confirm.
 *
 * Availability always comes from /api/availability, which runs exactly the same
 * rules as the booking action (business hours, holidays, breaks, lead time,
 * buffer, double-booking), so a slot offered here can never be rejected for a
 * reason the customer could have seen. The final submission goes through the
 * `createBookingAction` server action, where the partial unique index is the
 * last line of defence against two people booking the same slot.
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Calendar,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { createBookingAction } from "@/server/actions/booking";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { formatDuration, formatMinutes } from "@/lib/format";
import { DAY_NAMES_SHORT } from "@/lib/constants";

export type BookableServiceOption = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  durationMinutes: number;
  startingPrice: number | null;
  currency: string;
  categoryName: string;
  image: string | null;
};

type SlotOption = {
  startMinutes: number;
  endMinutes: number;
  label: string;
  available: boolean;
  reason?: string;
};

type DayOption = {
  date: string;
  dayOfWeek: number;
  isOpen: boolean;
  closedReason?: string;
  closedMessage?: string;
  holidayName?: string;
  slots: SlotOption[];
  availableCount: number;
};

const STEPS = ["Service", "Date", "Time", "Note", "Confirm"] as const;

function isoDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function prettyDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-IN", { timeZone: "UTC", ...options });
}

function todayParts() {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return { year: ist.getFullYear(), month: ist.getMonth(), day: ist.getDate() };
}

export function BookingWizard({
  services,
  initialServiceId,
  customerName,
  bookingNote,
  cancellationWindowHours,
}: {
  services: BookableServiceOption[];
  initialServiceId?: string;
  customerName: string;
  bookingNote: string;
  cancellationWindowHours: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(initialServiceId ? 1 : 0);
  const [serviceId, setServiceId] = useState(initialServiceId ?? "");
  const [date, setDate] = useState("");
  const [startMinutes, setStartMinutes] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = todayParts();
  const [view, setView] = useState({ year: today.year, month: today.month });

  // Availability is cached per month, which makes "loading" and "failed"
  // derivable during render instead of being pushed through effects.
  const [daysByMonth, setDaysByMonth] = useState<Record<string, DayOption[]>>({});
  const [failedMonths, setFailedMonths] = useState<string[]>([]);

  const service = useMemo(() => services.find((item) => item.id === serviceId) ?? null, [serviceId, services]);

  /* ------------------------------------------------------------ availability */
  const daysInView = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const monthKey = `${view.year}-${view.month}`;

  const days = useMemo(() => daysByMonth[monthKey] ?? [], [daysByMonth, monthKey]);
  const loadingDays = Boolean(serviceId) && !daysByMonth[monthKey] && !failedMonths.includes(monthKey);
  const availabilityError = failedMonths.includes(monthKey)
    ? "We could not load availability. Please refresh or call the studio."
    : null;

  useEffect(() => {
    if (!serviceId) return;
    const controller = new AbortController();

    fetch(`/api/availability?serviceId=${serviceId}&from=${isoDate(view.year, view.month, 1)}&days=${daysInView}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload?.ok) throw new Error(payload?.error ?? "Availability unavailable");
        setDaysByMonth((current) => ({ ...current, [monthKey]: payload.days as DayOption[] }));
        setFailedMonths((current) => current.filter((key) => key !== monthKey));
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setFailedMonths((current) => (current.includes(monthKey) ? current : [...current, monthKey]));
      });

    return () => controller.abort();
  }, [serviceId, view.year, view.month, daysInView, monthKey]);

  const dayMap = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const selectedDay = date ? dayMap.get(date) : undefined;

  const chooseService = useCallback((id: string) => {
    setServiceId(id);
    setDate("");
    setStartMinutes(null);
    setStep(1);
  }, []);

  const chooseDate = (value: string) => {
    setDate(value);
    setStartMinutes(null);
    setStep(2);
  };

  const canContinue =
    (step === 0 && Boolean(serviceId)) ||
    (step === 1 && Boolean(date)) ||
    (step === 2 && startMinutes !== null) ||
    step === 3 ||
    step === 4;

  /* -------------------------------------------------------------- submission */
  const submit = () => {
    if (!serviceId || !date || startMinutes === null) return;
    setError(null);

    startTransition(async () => {
      const result = await createBookingAction({
        serviceId,
        date,
        startMinutes,
        customerNote: note,
      });

      if (result.ok) {
        setReference(result.data?.reference ?? null);
        notifyResult(result);
        router.refresh();
      } else {
        setError(result.error);
        notifyResult(result);
        if (result.fieldErrors?.startMinutes) {
          setStartMinutes(null);
          setStep(2);
        }
      }
    });
  };

  /* --------------------------------------------------------------- confirmed */
  if (reference) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blush text-rosegold">
          <Check size={30} />
        </span>
        <h2 className="mt-5 text-3xl">Appointment requested</h2>
        <p className="mt-3 text-sm text-muted">
          Thank you, {customerName.split(" ")[0]}. Your request is with the studio — you will receive a confirmation
          shortly. Keep your reference handy.
        </p>

        <div className="card mt-7 p-6 text-left">
          <dl className="space-y-3 text-sm">
            <Row label="Reference" value={reference} strong />
            <Row label="Service" value={service?.name ?? "—"} />
            <Row label="Date" value={date ? prettyDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"} />
            <Row label="Time" value={startMinutes !== null ? formatMinutes(startMinutes) : "—"} />
            <Row label="Duration" value={service ? formatDuration(service.durationMinutes) : "—"} />
            {note ? <Row label="Your note" value={note} /> : null}
          </dl>
          <p className="mt-5 rounded-xl bg-cream-deep p-4 text-xs text-muted">
            Need to change something? Cancel free of charge up to {cancellationWindowHours} hours before your
            appointment from “My appointments”.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => router.push("/appointments")}>
            View my appointments
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setReference(null);
              setStep(0);
              setServiceId("");
              setDate("");
              setStartMinutes(null);
              setNote("");
            }}
          >
            Book another appointment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ------------------------------------------------------------- stepper */}
      <ol className="mx-auto flex max-w-3xl items-center justify-between gap-1 text-[0.68rem] uppercase tracking-[0.14em]">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <button
              type="button"
              onClick={() => index < step && setStep(index)}
              disabled={index > step}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.7rem] transition",
                index < step
                  ? "border-rosegold bg-rosegold text-white"
                  : index === step
                    ? "border-rosegold bg-blush text-rosegold-dark"
                    : "border-line bg-white text-muted"
              )}
              aria-current={index === step ? "step" : undefined}
            >
              {index < step ? <Check size={12} /> : index + 1}
            </button>
            <span className={cn("hidden sm:inline", index === step ? "text-charcoal" : "text-muted")}>{label}</span>
            {index < STEPS.length - 1 ? <span className="h-px flex-1 bg-line" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>

      {bookingNote ? (
        <p className="mx-auto mt-6 flex max-w-3xl items-start gap-2 rounded-2xl bg-blush/60 p-4 text-xs text-charcoal-soft">
          <Info size={14} className="mt-0.5 shrink-0 text-rosegold" />
          {bookingNote}
        </p>
      ) : null}

      {error ? (
        <div className="mx-auto mt-6 max-w-3xl">
          <Alert tone="danger" title="We could not confirm that booking">
            {error}
          </Alert>
        </div>
      ) : null}

      <div className="mx-auto mt-8 grid max-w-6xl gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-5 sm:p-7">
          {/* ------------------------------------------------- step 1: service */}
          {step === 0 ? (
            <section aria-labelledby="step-service">
              <h2 id="step-service" className="font-display text-2xl">
                Choose your service
              </h2>
              <p className="mt-2 text-sm text-muted">
                Not sure? Pick the closest match — your artist will fine-tune it with you.
              </p>

              <ul className="mt-6 space-y-3">
                {services.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => chooseService(option.id)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition",
                        serviceId === option.id
                          ? "border-rosegold bg-blush/50"
                          : "border-line bg-white hover:border-rosegold-soft"
                      )}
                    >
                      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-nude">
                        {option.image ? (
                          <Image src={option.image} alt="" fill sizes="64px" className="object-cover" />
                        ) : (
                          <span className="absolute inset-0 grid place-items-center text-nude-dark">
                            <Sparkles size={18} />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{option.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{option.shortDescription}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-3 text-[0.7rem] text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} /> {formatDuration(option.durationMinutes)}
                          </span>
                          <span>{option.categoryName}</span>
                          {option.startingPrice ? (
                            <span className="text-rosegold-dark">
                              ₹{option.startingPrice.toLocaleString("en-IN")} onwards
                            </span>
                          ) : null}
                        </span>
                      </span>
                      {serviceId === option.id ? <Check size={18} className="shrink-0 text-rosegold" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ---------------------------------------------------- step 2: date */}
          {step === 1 ? (
            <section aria-labelledby="step-date">
              <h2 id="step-date" className="font-display text-2xl">
                Pick a date
              </h2>
              <p className="mt-2 text-sm text-muted">
                We are open {service ? `for ${formatDuration(service.durationMinutes)}` : ""} on the days shown in
                colour. Closed days and fully booked days are disabled.
              </p>

              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() =>
                    setView((current) =>
                      current.month === 0
                        ? { year: current.year - 1, month: 11 }
                        : { ...current, month: current.month - 1 }
                    )
                  }
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <p className="font-display text-lg" aria-live="polite">
                  {monthLabel(view.year, view.month)}
                </p>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() =>
                    setView((current) =>
                      current.month === 11
                        ? { year: current.year + 1, month: 0 }
                        : { ...current, month: current.month + 1 }
                    )
                  }
                  aria-label="Next month"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[0.68rem] uppercase tracking-wider text-muted">
                {DAY_NAMES_SHORT.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() }).map((_, index) => (
                  <span key={`blank-${index}`} aria-hidden="true" />
                ))}

                {Array.from({ length: daysInView }).map((_, index) => {
                  const dayNumber = index + 1;
                  const value = isoDate(view.year, view.month, dayNumber);
                  const info = dayMap.get(value);
                  const isSelected = date === value;
                  const bookable = Boolean(info?.availableCount);
                  const disabled = loadingDays || !info || !bookable;

                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => chooseDate(value)}
                      aria-label={`${prettyDate(value, { weekday: "long", day: "numeric", month: "long" })}${bookable ? `, ${info?.availableCount} slots` : ", unavailable"}`}
                      aria-pressed={isSelected}
                      title={info?.closedMessage ?? info?.holidayName ?? undefined}
                      className={cn(
                        "relative aspect-square rounded-xl border text-sm transition",
                        isSelected
                          ? "border-rosegold bg-rosegold text-white"
                          : bookable
                            ? "border-line bg-white hover:border-rosegold-soft"
                            : "cursor-not-allowed border-transparent bg-cream-deep text-muted/60",
                        info?.holidayName && !isSelected ? "bg-blush/40" : ""
                      )}
                    >
                      {dayNumber}
                      {bookable && !isSelected ? (
                        <span className="absolute inset-x-0 bottom-1.5 mx-auto h-1 w-1 rounded-full bg-rosegold" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {loadingDays ? (
                <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted">
                  <Loader2 size={14} className="animate-spin" /> Checking availability…
                </p>
              ) : null}
              {availabilityError ? (
                <p className="mt-4 text-xs text-danger">{availabilityError}</p>
              ) : null}

              {!serviceId ? (
                <p className="mt-4 text-sm text-muted">Choose a service first to see available dates.</p>
              ) : null}
            </section>
          ) : null}

          {/* ---------------------------------------------------- step 3: time */}
          {step === 2 ? (
            <section aria-labelledby="step-time">
              <h2 id="step-time" className="font-display text-2xl">
                Choose a time
              </h2>
              <p className="mt-2 text-sm text-muted">
                {date ? prettyDate(date, { weekday: "long", day: "numeric", month: "long" }) : ""}
                {service ? ` · ${formatDuration(service.durationMinutes)} appointment` : ""}
              </p>

              {selectedDay?.holidayName ? (
                <p className="mt-4 rounded-xl bg-blush/60 p-4 text-xs text-charcoal-soft">
                  {selectedDay.holidayName} — the studio is closed. Please choose another date.
                </p>
              ) : null}

              {selectedDay?.slots.length ? (
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {selectedDay.slots.map((slot) => (
                    <button
                      key={slot.startMinutes}
                      type="button"
                      disabled={!slot.available}
                      title={slot.reason}
                      onClick={() => {
                        setStartMinutes(slot.startMinutes);
                        setStep(3);
                      }}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-sm transition",
                        startMinutes === slot.startMinutes
                          ? "border-rosegold bg-rosegold text-white"
                          : slot.available
                            ? "border-line bg-white hover:border-rosegold-soft"
                            : "cursor-not-allowed border-transparent bg-cream-deep text-muted/60 line-through"
                      )}
                    >
                      {slot.label.split(" – ")[0]}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-cream-deep p-4 text-sm text-muted">
                  {selectedDay?.closedMessage ?? "No slots left on this date — please pick another day."}
                </p>
              )}
            </section>
          ) : null}

          {/* ---------------------------------------------------- step 4: note */}
          {step === 3 ? (
            <section aria-labelledby="step-note">
              <h2 id="step-note" className="font-display text-2xl">
                Anything we should know?
              </h2>
              <p className="mt-2 text-sm text-muted">
                Inspiration, allergies, nail history or a reference photo link — all optional, but it helps your artist
                prepare.
              </p>

              <label htmlFor="customerNote" className="label mt-6">
                Note for your artist <span className="text-muted">(optional)</span>
              </label>
              <textarea
                id="customerNote"
                className="textarea mt-2 min-h-[140px]"
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. I would love a soft chrome French set for a wedding on the 14th."
              />
              <p className="mt-2 text-right text-xs text-muted">{note.length}/500</p>
            </section>
          ) : null}

          {/* ------------------------------------------------- step 5: confirm */}
          {step === 4 ? (
            <section aria-labelledby="step-confirm">
              <h2 id="step-confirm" className="font-display text-2xl">
                Review and confirm
              </h2>
              <p className="mt-2 text-sm text-muted">
                Nothing is charged online — the studio confirms your slot by email and phone.
              </p>

              <dl className="mt-6 space-y-3 text-sm">
                <Row label="Service" value={service?.name ?? "—"} />
                <Row label="Duration" value={service ? formatDuration(service.durationMinutes) : "—"} />
                <Row
                  label="Date"
                  value={date ? prettyDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}
                />
                <Row label="Time" value={startMinutes !== null ? formatMinutes(startMinutes) : "—"} />
                <Row label="Name" value={customerName} />
                {note ? <Row label="Note" value={note} /> : null}
              </dl>

              <button type="button" className="btn-primary btn-lg mt-7 w-full" onClick={submit} disabled={pending}>
                {pending ? <Loader2 size={17} className="animate-spin" /> : <CalendarCheck size={17} />}
                {pending ? "Reserving your slot…" : "Request appointment"}
              </button>
              <p className="mt-3 text-center text-xs text-muted">
                By requesting this appointment you agree to the studio&apos;s cancellation policy — free cancellation up
                to {cancellationWindowHours} hours before your slot.
              </p>
            </section>
          ) : null}

          {/* ------------------------------------------------------- navigation */}
          {step > 0 ? (
            <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
              <button type="button" className="btn-ghost btn-sm" onClick={() => setStep((current) => current - 1)}>
                <ChevronLeft size={15} /> Back
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={!canContinue || (step === 1 && !date)}
                  onClick={() => setStep((current) => current + 1)}
                >
                  Continue <ChevronRight size={15} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ------------------------------------------------------------ summary */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-5">
            <h2 className="font-display text-lg">Your booking</h2>

            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow icon={<Sparkles size={14} />} label="Service" value={service?.name} />
              <SummaryRow
                icon={<Calendar size={14} />}
                label="Date"
                value={date ? prettyDate(date, { weekday: "short", day: "numeric", month: "short" }) : undefined}
              />
              <SummaryRow
                icon={<Clock size={14} />}
                label="Time"
                value={startMinutes !== null ? formatMinutes(startMinutes) : undefined}
              />
              <SummaryRow icon={<StickyNote size={14} />} label="Note" value={note || undefined} />
            </dl>

            <div className="mt-5 rounded-xl bg-cream-deep p-4 text-xs text-muted">
              <p className="font-medium text-charcoal-soft">Free cancellation</p>
              <p className="mt-1">
                Cancel or reschedule up to {cancellationWindowHours} hours before your appointment at no cost.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-4 border-b border-line pb-2.5">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className={cn("min-w-0 flex-1 break-words", strong ? "font-medium text-rosegold-dark" : "text-charcoal-soft")}>
        {value}
      </dd>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-rosegold">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-[0.68rem] uppercase tracking-[0.16em] text-muted">{label}</dt>
        <dd className={cn("break-words", value ? "text-charcoal-soft" : "text-muted/70")}>{value ?? "Not selected"}</dd>
      </div>
    </div>
  );
}
