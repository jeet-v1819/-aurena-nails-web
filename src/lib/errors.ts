/**
 * Result envelope shared by every server action.
 *
 * Server actions never throw raw errors at the client: they return a
 * discriminated result that the UI can render as a toast and/or inline field
 * errors. Technical details stay in the server log.
 */
import { Prisma } from "@prisma/client";

export type ActionSuccess<T = undefined> = {
  ok: true;
  message: string;
  data?: T;
};

export type ActionFailure = {
  ok: false;
  error: string;
  /** Field-level messages, keyed by form field name. */
  fieldErrors?: Record<string, string[]>;
  /** Machine-readable code so the UI can react (e.g. "INACTIVE_ACCOUNT"). */
  code?: string;
};

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function actionSuccess<T>(message: string, data?: T): ActionSuccess<T> {
  return { ok: true, message, data };
}

export function actionFailure(
  error: string,
  options: { fieldErrors?: Record<string, string[]>; code?: string } = {}
): ActionFailure {
  return { ok: false, error, ...options };
}

/** Friendly, non-technical message shown to the user. */
export const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Converts any thrown value into a safe, human-readable failure.
 * Unique-constraint violations are mapped to the field they belong to.
 */
export function toActionFailure(error: unknown, fallback = GENERIC_ERROR): ActionFailure {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) ?? "";
      const fields = Array.isArray(target) ? target : String(target).split(",");
      const messages: Record<string, string> = {
        email: "This email address is already registered.",
        mobile: "This mobile number is already registered.",
        slug: "A record with this URL slug already exists.",
        reference: "That booking reference already exists.",
        Appointment_active_slot_key: "That time slot was just taken. Please choose another time.",
        date: "A holiday already exists on that date.",
        dayOfWeek: "Opening hours for that day already exist.",
        key: "That content key already exists.",
        tokenHash: "This reset link has already been used.",
      };
      const fieldErrors: Record<string, string[]> = {};
      for (const field of fields) {
        const key = field.trim();
        fieldErrors[key] = [messages[key] ?? "This value is already in use."];
      }
      const first = Object.values(fieldErrors)[0]?.[0];
      return { ok: false, error: first ?? "This record already exists.", fieldErrors, code: "DUPLICATE" };
    }

    if (error.code === "P2025") {
      return { ok: false, error: "That record no longer exists. Refresh the page and try again.", code: "NOT_FOUND" };
    }

    if (error.code === "P2003") {
      return {
        ok: false,
        error: "This record is linked to other data, so it cannot be removed. Deactivate it instead.",
        code: "FOREIGN_KEY",
      };
    }

    if (error.code === "P2004") {
      return {
        ok: false,
        error: "The change conflicts with an existing record or database rule. Please review the values and try again.",
        code: "CONSTRAINT",
      };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { ok: false, error: "We cannot reach the database right now. Please try again in a moment.", code: "DB_UNAVAILABLE" };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { ok: false, error: "Some of the submitted values were invalid. Please check the form.", code: "VALIDATION" };
  }

  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code };
  }

  console.error("[aurena] unhandled error:", error);
  return { ok: false, error: fallback };
}

/** Domain-level error carrying a user-facing message. */
export class AppError extends Error {
  code: string;

  constructor(message: string, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export function isActionFailure<T>(result: ActionResult<T>): result is ActionFailure {
  return result.ok === false;
}
