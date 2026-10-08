"use server";

/** Admin actions for customers, appointments, reviews and contact messages. */
import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/lib/auth/session";
import { actionFailure, actionSuccess, toActionFailure, type ActionResult } from "@/lib/errors";
import { normalizeInput, validate } from "@/lib/validation";
import { adminCustomerSchema, appointmentStatusSchema, reviewModerationSchema } from "@/validators/admin";
import { adminUpdateCustomer, deleteCustomer, setCustomerActive } from "@/server/services/users";
import { changeAppointmentStatus, updateAppointmentNote } from "@/server/services/bookings";
import { moderateReview } from "@/server/services/reviews";
import { deleteMessage, setMessageRead } from "@/server/services/messages";

async function requireAdminOrFail() {
  const admin = await getAdminOrNull();
  if (!admin) {
    return {
      ok: false as const,
      failure: actionFailure("You need to be signed in as an administrator.", { code: "FORBIDDEN" }),
    };
  }
  return { ok: true as const, admin };
}

/* --------------------------------------------------------------- customers */

export async function updateCustomerAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const customerId = String(data.customerId ?? "");
    if (!customerId) return actionFailure("Missing customer.");

    const parsed = validate(adminCustomerSchema, data);
    if (!parsed.success) return parsed.failure;

    const result = await adminUpdateCustomer(guard.admin.id, customerId, parsed.data);
    if (!result.ok) return actionFailure(result.error, { fieldErrors: result.fieldErrors });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${customerId}`);
    return actionSuccess("Customer updated successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not update that customer.");
  }
}

export async function setCustomerActiveAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const customerId = String(data.customerId ?? "");
    const isActive = data.isActive === true || data.isActive === "true";
    if (!customerId) return actionFailure("Missing customer.");

    const result = await setCustomerActive(guard.admin.id, customerId, isActive);
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/admin/customers");
    return actionSuccess(isActive ? "Customer activated." : "Customer deactivated — they can no longer sign in.");
  } catch (error) {
    return toActionFailure(error, "We could not change that customer's status.");
  }
}

export async function deleteCustomerAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const customerId = String(data.customerId ?? "");
    if (!customerId) return actionFailure("Missing customer.");

    const result = await deleteCustomer(guard.admin.id, customerId);
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/admin/customers");
    return actionSuccess("Customer deleted. Appointment history was kept for the studio's records.");
  } catch (error) {
    return toActionFailure(error, "We could not delete that customer.");
  }
}

/* ------------------------------------------------------------ appointments */

export async function updateAppointmentStatusAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const parsed = validate(appointmentStatusSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await changeAppointmentStatus(guard.admin.id, parsed.data);
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/admin/appointments");
    revalidatePath("/admin/dashboard");
    revalidatePath("/appointments");
    return actionSuccess(result.message);
  } catch (error) {
    return toActionFailure(error, "We could not update that appointment.");
  }
}

export async function updateAppointmentNoteAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const appointmentId = String(data.appointmentId ?? "");
    const adminNote = String(data.adminNote ?? "").slice(0, 600);
    if (!appointmentId) return actionFailure("Missing appointment.");

    await updateAppointmentNote(guard.admin.id, appointmentId, adminNote);
    revalidatePath("/admin/appointments");
    return actionSuccess("Internal note saved.");
  } catch (error) {
    return toActionFailure(error, "We could not save that note.");
  }
}

/* ----------------------------------------------------------------- reviews */

export async function moderateReviewAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const parsed = validate(reviewModerationSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await moderateReview(guard.admin.id, parsed.data);
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/admin/reviews");
    revalidatePath("/services");
    return actionSuccess(result.message);
  } catch (error) {
    return toActionFailure(error, "We could not update that review.");
  }
}

/* ---------------------------------------------------------------- messages */

export async function setMessageReadAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const messageId = String(data.messageId ?? "");
    const isRead = data.isRead === true || data.isRead === "true";
    if (!messageId) return actionFailure("Missing message.");

    await setMessageRead(guard.admin.id, messageId, isRead);
    revalidatePath("/admin/messages");
    revalidatePath("/admin/dashboard");
    return actionSuccess(isRead ? "Message marked as read." : "Message marked as unread.");
  } catch (error) {
    return toActionFailure(error, "We could not update that message.");
  }
}

export async function deleteMessageAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const messageId = String(data.messageId ?? "");
    if (!messageId) return actionFailure("Missing message.");

    await deleteMessage(guard.admin.id, messageId);
    revalidatePath("/admin/messages");
    return actionSuccess("Message deleted.");
  } catch (error) {
    return toActionFailure(error, "We could not delete that message.");
  }
}
