/**
 * Zod → ActionFailure bridge used by every server action, so validation
 * behaviour (and the wording of errors) is identical everywhere.
 */
import { z, type ZodType } from "zod";
import { actionFailure, type ActionFailure } from "@/lib/errors";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; failure: ActionFailure; fieldErrors: Record<string, string[]> };

export function validate<T>(schema: ZodType<T>, input: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(input);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
  const firstMessage =
    Object.values(fieldErrors).flat()[0] ?? "Please check the highlighted fields and try again.";

  return {
    success: false,
    failure: actionFailure(firstMessage, { fieldErrors, code: "VALIDATION" }),
    fieldErrors,
  };
}

/** Builds a plain object from FormData so zod can validate it. */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > 0) result[key] = value;
      continue;
    }
    const existing = result[key];
    if (existing === undefined) result[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else result[key] = [existing, value];
  }
  return result;
}

/**
 * Server actions accept either a FormData (progressive-enhancement <form>) or a
 * plain object (called from React Hook Form). This normalises both.
 */
export function normalizeInput(source: FormData | Record<string, unknown> | undefined | null) {
  if (!source) return {};
  if (source instanceof FormData) return formDataToObject(source);
  return source;
}

/** "10:30" → 630 minutes past midnight. */
export function timeStringToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 630 → "10:30" (value for an <input type="time">). */
export function minutesToTimeString(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** A reusable "HH:MM" validator input. */
export const timeStringSchema = z.string().regex(/^\d{1,2}:\d{2}$/, "Use a time like 10:30.");
