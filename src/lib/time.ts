/**
 * Studio-local time helpers.
 *
 * Opening hours, holidays and appointment slots are all expressed as *studio
 * local* minutes-from-midnight, so the maths never depends on where the server
 * happens to run (UTC on Vercel, IST in the studio).
 */
export const STUDIO_TIMEZONE = process.env.STUDIO_TIMEZONE || "Asia/Kolkata";

function partsFor(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hours: Number(get("hour")) % 24,
    minutes: Number(get("minute")),
  };
}

/** Current date (YYYY-MM-DD) and minutes-from-midnight in the studio timezone. */
export function zonedNow(now: Date = new Date(), timeZone: string = STUDIO_TIMEZONE) {
  const { date, hours, minutes } = partsFor(now, timeZone);
  return { date, minutesOfDay: hours * 60 + minutes };
}

/** "YYYY-MM-DD" for a Date, in the studio timezone. */
export function zonedDateString(date: Date, timeZone: string = STUDIO_TIMEZONE) {
  return partsFor(date, timeZone).date;
}

/** Parses "YYYY-MM-DD" into a UTC-midnight Date (Prisma `@db.Date`). */
export function dateOnlyFromString(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) return null;
  return date;
}

/** Adds whole days to a UTC-midnight date. */
export function addDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/** 0 = Sunday … 6 = Saturday, in the studio timezone. */
export function dayOfWeekFor(date: Date, timeZone: string = STUDIO_TIMEZONE) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

export function todayDateOnly(): Date {
  const { date } = zonedNow();
  return dateOnlyFromString(date)!;
}

/** Converts a studio-local calendar date and minutes-from-midnight to an instant. */
export function studioDateTimeToDate(
  date: Date | string,
  minutesOfDay: number,
  timeZone: string = STUDIO_TIMEZONE
): Date | null {
  const dateKey = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  const dateOnly = dateOnlyFromString(dateKey);
  if (!dateOnly || !Number.isInteger(minutesOfDay) || minutesOfDay < 0 || minutesOfDay >= 24 * 60) return null;

  const year = dateOnly.getUTCFullYear();
  const month = dateOnly.getUTCMonth();
  const day = dateOnly.getUTCDate();
  const desiredLocalAsUtc = Date.UTC(year, month, day, Math.floor(minutesOfDay / 60), minutesOfDay % 60);
  let timestamp = desiredLocalAsUtc;

  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const local = partsFor(new Date(timestamp), timeZone);
      const [localYear, localMonth, localDay] = local.date.split("-").map(Number);
      const actualLocalAsUtc = Date.UTC(localYear, localMonth - 1, localDay, local.hours, local.minutes);
      const difference = desiredLocalAsUtc - actualLocalAsUtc;
      if (difference === 0) return new Date(timestamp);
      timestamp += difference;
    }
  } catch {
    return null;
  }

  return null;
}
