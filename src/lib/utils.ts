/** Small generic helpers used across the codebase. */
import { PAGE_SIZE } from "@/lib/constants";

/** Conditional class names. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function parsePositiveInt(input: unknown, fallback: number, max = 10_000) {
  const value = typeof input === "string" ? Number.parseInt(input, 10) : Number(input);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

export function parsePage(input: unknown) {
  return parsePositiveInt(input, 1, 1000);
}

/** Prisma pagination arguments. */
export function paginate(page: number, pageSize: number = PAGE_SIZE) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function totalPages(count: number, pageSize: number = PAGE_SIZE) {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

/** Parses "a, b, c" or a JSON array string into a clean list of tags. */
export function parseTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return unique(input.map((tag) => String(tag).trim()).filter(Boolean));
  }
  if (typeof input !== "string") return [];
  return unique(
    input
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
}

export function truncate(text: string, length = 140) {
  return text.length <= length ? text : `${text.slice(0, length).trimEnd()}…`;
}

/** Splits "  Hema   Patel " into first/last name. */
export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/**
 * Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Returns null when the number is not a valid Indian mobile.
 */
export function normaliseMobile(input: string): string | null {
  const digits = String(input).replace(/[^\d+]/g, "");
  const stripped = digits.replace(/^\+/, "");

  let local: string | null = null;
  if (/^91[6-9]\d{9}$/.test(stripped)) local = stripped.slice(2);
  else if (/^0[6-9]\d{9}$/.test(stripped)) local = stripped.slice(1);
  else if (/^[6-9]\d{9}$/.test(stripped)) local = stripped;

  return local ? `+91${local}` : null;
}

/** "  HELLO@Example.COM " -> "hello@example.com" */
export function normaliseEmail(input: string) {
  return String(input).trim().toLowerCase();
}

/** Strips characters that could be used for HTML/script injection in plain text. */
export function sanitiseText(input: string) {
  return String(input)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style)[^>]*>/gi, "")
    .trim();
}

/** Date (UTC midnight) helpers — appointments are stored as calendar dates. */
export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return date;
}

/** YYYY-MM-DD in UTC (for `input[type=date]` values and URLs). */
export function toDateInputValue(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toISOString().slice(0, 10);
}

export function isPastDate(date: Date) {
  return toDateOnly(date).getTime() < toDateOnly(new Date()).getTime();
}

/** Replaces {name} placeholders — used by email/notification templates. */
export function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}
