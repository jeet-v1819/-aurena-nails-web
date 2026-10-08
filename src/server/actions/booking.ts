"use server";

/** Booking server actions used by the reservation wizard and the appointment list. */
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { actionFailure, actionSuccess, toActionFailure, type ActionResult } from "@/lib/errors";
import { normalizeInput, validate } from "@/lib/validation";
import { bookingSchema, cancelAppointmentSchema, reviewSchema } from "@/validators/customer";
import { cancelAppointmentByCustomer, createAppointment } from "@/server/services/bookings";
import { createReview } from "@/server/services/reviews";

export async function createBookingAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult<{ reference: string; id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return actionFailure("Please sign in to book an appointment.", {
        code: "AUTH_REQUIRED",
        fieldErrors: { serviceId: ["Please sign in to continue."] },
      });
    }

    const parsed = validate(bookingSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await createAppointment(user.id, parsed.data);
    if (!result.ok) return actionFailure(result.error, { fieldErrors: result.fieldErrors });

    revalidatePath("/appointments");
    revalidatePath("/booking");
    revalidatePath("/notifications");

    return actionSuccess(`Appointment requested — your reference is ${result.appointment.reference}.`, {
      reference: result.appointment.reference,
      id: result.appointment.id,
    });
  } catch (error) {
    return toActionFailure(error, "We could not complete your booking. Please try again.");
  }
}

export async function cancelBookingAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Please sign in to manage your appointments.", { code: "AUTH_REQUIRED" });

    const parsed = validate(cancelAppointmentSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await cancelAppointmentByCustomer(user.id, parsed.data.appointmentId, parsed.data.reason || undefined);
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/appointments");
    revalidatePath("/notifications");
    return actionSuccess(result.message);
  } catch (error) {
    return toActionFailure(error, "We could not cancel that appointment. Please try again.");
  }
}

export async function createReviewAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Please sign in to leave a review.", { code: "AUTH_REQUIRED" });

    const parsed = validate(reviewSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await createReview(user.id, parsed.data);
    if (!result.ok) return actionFailure(result.error, { fieldErrors: result.fieldErrors });

    revalidatePath("/appointments");
    revalidatePath("/profile");
    return actionSuccess(result.message);
  } catch (error) {
    return toActionFailure(error, "We could not save your review. Please try again.");
  }
}
