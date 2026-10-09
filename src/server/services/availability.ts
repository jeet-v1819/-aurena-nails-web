/**
 * Availability engine.
 *
 * Single source of truth for "can this service be booked at this time?".
 * Every booking rule the studio configures is enforced here. Booking writes
 * recheck under a transaction-scoped per-date lock, with database constraints
 * as a final guard against overlapping active intervals.
 *
 * Rules applied, in order:
 *   1. the date must not be in the past
 *   2. the date must be within the booking window (max advance days)
 *   3. the date must not be an active holiday
 *   4. the studio must be open that weekday (business hours)
 *   5. the slot must fit inside opening hours
 *   6. the slot must not collide with the configured break
 *   7. the slot must respect the minimum notice (lead time) for today
 *   8. the slot must not overlap an existing PENDING/CONFIRMED appointment,
 *      including the clean-up buffer between clients
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatMinutes } from "@/lib/format";
import { addDays, dateOnlyFromString, todayDateOnly, zonedNow } from "@/lib/time";
import { getBusinessHours, getHoliday, type BusinessHour } from "./business-hours";
import { getBookingSettings } from "./content";

export type SlotAvailability = {
  startMinutes: number;
  endMinutes: number;
  label: string;
  available: boolean;
  reason?: string;
};

export type ClosedReason = "PAST" | "TOO_FAR" | "HOLIDAY" | "CLOSED" | "FULLY_BOOKED" | "NO_SERVICE";

export type DayAvailability = {
  date: string;
  dayOfWeek: number;
  isOpen: boolean;
  closedReason?: ClosedReason;
  closedMessage?: string;
  holidayName?: string;
  openMinutes: number | null;
  closeMinutes: number | null;
  breakStartMinutes: number | null;
  breakEndMinutes: number | null;
  slots: SlotAvailability[];
  availableCount: number;
};

type BusyInterval = { startMinutes: number; endMinutes: number };

function overlaps(a: BusyInterval, b: BusyInterval) {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

function closedDay(
  date: Date,
  hours: BusinessHour,
  reason: ClosedReason,
  message: string,
  holidayName?: string
): DayAvailability {
  return {
    date: date.toISOString().slice(0, 10),
    dayOfWeek: hours.dayOfWeek,
    isOpen: false,
    closedReason: reason,
    closedMessage: message,
    holidayName,
    openMinutes: hours.isOpen ? hours.openMinutes : null,
    closeMinutes: hours.isOpen ? hours.closeMinutes : null,
    breakStartMinutes: hours.breakStartMinutes,
    breakEndMinutes: hours.breakEndMinutes,
    slots: [],
    availableCount: 0,
  };
}

/**
 * Availability for a span of days — powers both the month calendar and a single
 * day's slot list, with one query instead of N.
 */
export async function getAvailabilityRange(input: {
  durationMinutes: number;
  fromDate?: Date;
  days?: number;
  /** Exclude this appointment from the busy list (used when rescheduling). */
  ignoreAppointmentId?: string;
  /** Use the caller's transaction so bookings recheck slots under the date lock. */
  db?: Prisma.TransactionClient;
}): Promise<DayAvailability[]> {
  const db = input.db ?? prisma;
  const days = Math.min(Math.max(input.days ?? 1, 1), 120);
  const from = input.fromDate ?? todayDateOnly();
  const to = addDays(from, days - 1);

  const [hours, settings, holidays, appointments] = await Promise.all([
    getBusinessHours(db),
    getBookingSettings(db),
    db.holiday.findMany({
      where: { isActive: true, date: { gte: from, lte: to } },
      select: { date: true, name: true },
    }),
    db.appointment.findMany({
      where: {
        date: { gte: from, lte: to },
        status: { in: ["PENDING", "CONFIRMED"] },
        ...(input.ignoreAppointmentId ? { NOT: { id: input.ignoreAppointmentId } } : {}),
      },
      select: { date: true, startMinutes: true, endMinutes: true },
    }),
  ]);

  const holidayByDate = new Map(holidays.map((holiday) => [holiday.date.toISOString().slice(0, 10), holiday.name]));
  const busyByDate = new Map<string, BusyInterval[]>();
  for (const appointment of appointments) {
    const key = appointment.date.toISOString().slice(0, 10);
    const list = busyByDate.get(key) ?? [];
    list.push({ startMinutes: appointment.startMinutes, endMinutes: appointment.endMinutes });
    busyByDate.set(key, list);
  }

  const now = new Date();
  const { date: todayString, minutesOfDay: nowMinutes } = zonedNow(now);
  const firstFutureMinute = nowMinutes + (now.getSeconds() > 0 ? 1 : 0);
  const today = dateOnlyFromString(todayString)!;
  const lastBookable = addDays(today, settings.maxAdvanceDays);

  const result: DayAvailability[] = [];

  for (let index = 0; index < days; index += 1) {
    const date = addDays(from, index);
    const dateKey = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getUTCDay();
    const dayHours = hours.find((day) => day.dayOfWeek === dayOfWeek) ?? hours[0];

    if (date.getTime() < today.getTime()) {
      result.push(closedDay(date, dayHours, "PAST", "This date has already passed."));
      continue;
    }

    if (date.getTime() > lastBookable.getTime()) {
      result.push(
        closedDay(
          date,
          dayHours,
          "TOO_FAR",
          `Appointments open ${settings.maxAdvanceDays} days in advance. Please choose an earlier date.`
        )
      );
      continue;
    }

    const holidayName = holidayByDate.get(dateKey);
    if (holidayName) {
      result.push(closedDay(date, dayHours, "HOLIDAY", `The studio is closed — ${holidayName}.`, holidayName));
      continue;
    }

    if (!dayHours.isOpen) {
      result.push(closedDay(date, dayHours, "CLOSED", `The studio is closed on ${dayHours.dayName}s.`));
      continue;
    }

    const interval = dayHours.slotIntervalMinutes ?? settings.slotIntervalMinutes;
    const busy = busyByDate.get(dateKey) ?? [];
    const slots: SlotAvailability[] = [];

    // Nothing today can start before now + the configured notice period.
    const earliestStart = dateKey === todayString ? firstFutureMinute + settings.minLeadMinutes : -1;

    for (
      let start = dayHours.openMinutes;
      start + input.durationMinutes <= dayHours.closeMinutes;
      start += interval
    ) {
      const end = start + input.durationMinutes;
      const candidate = { startMinutes: start, endMinutes: end };
      let available = true;
      let reason: string | undefined;

      if (earliestStart >= 0 && start < earliestStart) {
        available = false;
        reason = "Too soon — please pick a later time.";
      }

      if (
        available &&
        dayHours.breakStartMinutes !== null &&
        dayHours.breakEndMinutes !== null &&
        overlaps(candidate, { startMinutes: dayHours.breakStartMinutes, endMinutes: dayHours.breakEndMinutes })
      ) {
        available = false;
        reason = "During the studio break.";
      }

      if (available) {
        for (const appointment of busy) {
          const padded = {
            startMinutes: appointment.startMinutes - settings.bufferMinutes,
            endMinutes: appointment.endMinutes + settings.bufferMinutes,
          };
          if (overlaps(candidate, padded)) {
            available = false;
            reason = "Already booked.";
            break;
          }
        }
      }

      slots.push({
        startMinutes: start,
        endMinutes: end,
        label: formatMinutes(start),
        available,
        reason,
      });
    }

    const availableCount = slots.filter((slot) => slot.available).length;

    result.push({
      date: dateKey,
      dayOfWeek,
      isOpen: true,
      ...(availableCount === 0
        ? { closedReason: "FULLY_BOOKED" as ClosedReason, closedMessage: "This day is fully booked." }
        : {}),
      openMinutes: dayHours.openMinutes,
      closeMinutes: dayHours.closeMinutes,
      breakStartMinutes: dayHours.breakStartMinutes,
      breakEndMinutes: dayHours.breakEndMinutes,
      slots,
      availableCount,
    });
  }

  return result;
}

/** Convenience wrapper for one day. */
export async function getDayAvailability(input: {
  date: string | Date;
  durationMinutes: number;
  ignoreAppointmentId?: string;
  db?: Prisma.TransactionClient;
}): Promise<DayAvailability | null> {
  const date = typeof input.date === "string" ? dateOnlyFromString(input.date) : input.date;
  if (!date) return null;

  const [day] = await getAvailabilityRange({
    durationMinutes: input.durationMinutes,
    fromDate: date,
    days: 1,
    ignoreAppointmentId: input.ignoreAppointmentId,
    db: input.db,
  });

  return day ?? null;
}

/**
 * Server-side gate used by the booking action: is this exact slot bookable?
 * Returns the reason when it is not, so the customer gets a useful message.
 */
export async function checkSlotBookable(input: {
  date: Date;
  startMinutes: number;
  durationMinutes: number;
  ignoreAppointmentId?: string;
  db?: Prisma.TransactionClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const day = await getDayAvailability({
    date: input.date,
    durationMinutes: input.durationMinutes,
    ignoreAppointmentId: input.ignoreAppointmentId,
    db: input.db,
  });

  if (!day) return { ok: false, error: "That date could not be understood. Please pick another." };
  if (!day.isOpen) {
    return { ok: false, error: day.closedMessage ?? "The studio is closed on that day." };
  }

  const slot = day.slots.find((candidate) => candidate.startMinutes === input.startMinutes);
  if (!slot) {
    return { ok: false, error: "That time is outside the studio's opening hours. Please pick another slot." };
  }
  if (!slot.available) {
    return { ok: false, error: `${formatMinutes(input.startMinutes)} is not available — ${slot.reason ?? "already booked."}` };
  }

  return { ok: true };
}

/** The next bookable day, used to pre-select a date in the booking wizard. */
export async function getNextAvailableDate(durationMinutes: number, withinDays = 30) {
  const days = await getAvailabilityRange({ durationMinutes, days: withinDays });
  return days.find((day) => day.isOpen && day.availableCount > 0) ?? null;
}

export async function getHolidayForDate(date: Date) {
  return getHoliday(date);
}
