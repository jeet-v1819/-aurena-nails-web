"use server";

/**
 * Customer-side actions: profile, wishlist, reviews, notifications and the
 * public contact form.
 */
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { actionFailure, actionSuccess, toActionFailure, type ActionResult } from "@/lib/errors";
import { normalizeInput, validate } from "@/lib/validation";
import { changePasswordSchema, contactSchema, profileSchema, reviewSchema, wishlistItemSchema } from "@/validators/customer";
import { changePassword, updateProfile } from "@/server/services/users";
import { createContactMessage } from "@/server/services/messages";
import { recalculateServiceRating, deleteOwnReview, updateOwnReview } from "@/server/services/reviews";
import { removeWishlistItem, toggleGalleryWishlist, toggleServiceWishlist } from "@/server/services/wishlist";
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from "@/server/services/notifications";

/* ------------------------------------------------------------------ profile */

export async function updateProfileAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Your session expired. Please sign in again.", { code: "AUTH_REQUIRED" });

    const parsed = validate(profileSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await updateProfile(user.id, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      mobile: parsed.data.mobile,
      avatarUrl: parsed.data.avatarUrl || undefined,
      avatarPublicId: parsed.data.avatarPublicId || undefined,
    });

    if (!result.ok) return actionFailure(result.error, { fieldErrors: result.fieldErrors });

    revalidatePath("/profile");
    return actionSuccess("Your profile has been updated.");
  } catch (error) {
    return toActionFailure(error, "We could not update your profile. Please try again.");
  }
}

export async function changePasswordAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Your session expired. Please sign in again.", { code: "AUTH_REQUIRED" });

    const parsed = validate(changePasswordSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const result = await changePassword(user.id, parsed.data.currentPassword, parsed.data.password);
    if (!result.ok) return actionFailure(result.error, { fieldErrors: result.fieldErrors });

    return actionSuccess("Your password has been changed.");
  } catch (error) {
    return toActionFailure(error, "We could not change your password. Please try again.");
  }
}

/* ----------------------------------------------------------------- wishlist */

export async function toggleServiceWishlistAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Please sign in to save your favourites.", { code: "AUTH_REQUIRED" });

    const parsed = validate(wishlistItemSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    if (!parsed.data.serviceId) return actionFailure("Missing service.");

    const result = await toggleServiceWishlist(user.id, parsed.data.serviceId);
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/wishlist");
    revalidatePath("/services");

    return actionSuccess(result.saved ? "Saved to your wishlist." : "Removed from your wishlist.", {
      saved: result.saved,
    });
  } catch (error) {
    return toActionFailure(error, "We could not update your wishlist. Please try again.");
  }
}

export async function toggleGalleryWishlistAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Please sign in to save your favourites.", { code: "AUTH_REQUIRED" });

    const parsed = validate(wishlistItemSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    if (!parsed.data.galleryImageId) return actionFailure("Missing design.");

    const result = await toggleGalleryWishlist(user.id, parsed.data.galleryImageId);
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/wishlist");
    revalidatePath("/gallery");

    return actionSuccess(result.saved ? "Saved to your wishlist." : "Removed from your wishlist.", {
      saved: result.saved,
    });
  } catch (error) {
    return toActionFailure(error, "We could not update your wishlist. Please try again.");
  }
}

export async function removeWishlistItemAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Your session expired. Please sign in again.", { code: "AUTH_REQUIRED" });

    const data = normalizeInput(source);
    const itemId = String(data.itemId ?? "");
    if (!itemId) return actionFailure("Missing wishlist item.");

    const removed = await removeWishlistItem(user.id, itemId);
    if (!removed) return actionFailure("That item is no longer in your wishlist.");

    revalidatePath("/wishlist");
    return actionSuccess("Removed from your wishlist.");
  } catch (error) {
    return toActionFailure(error, "We could not update your wishlist. Please try again.");
  }
}

/* ------------------------------------------------------------------ reviews */

export async function updateReviewAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Please sign in to edit your review.", { code: "AUTH_REQUIRED" });

    const data = normalizeInput(source);
    const reviewId = String(data.reviewId ?? "");
    const parsed = validate(reviewSchema, data);
    if (!parsed.success) return parsed.failure;

    const result = await updateOwnReview(user.id, reviewId, {
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/profile");
    revalidatePath(`/services/${result.review.service.slug}`);
    return actionSuccess(result.message);
  } catch (error) {
    return toActionFailure(error, "We could not update your review. Please try again.");
  }
}

export async function deleteReviewAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Please sign in to delete your review.", { code: "AUTH_REQUIRED" });

    const data = normalizeInput(source);
    const reviewId = String(data.reviewId ?? "");
    if (!reviewId) return actionFailure("Missing review.");

    const result = await deleteOwnReview(user.id, reviewId);
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/profile");
    return actionSuccess(result.message);
  } catch (error) {
    return toActionFailure(error, "We could not delete your review. Please try again.");
  }
}

/* ------------------------------------------------------------ notifications */

export async function markNotificationReadAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Your session expired.", { code: "AUTH_REQUIRED" });

    const data = normalizeInput(source);
    const notificationId = String(data.notificationId ?? "");
    if (!notificationId) return actionFailure("Missing notification.");

    const updated = await markNotificationRead(user.id, notificationId);
    if (!updated) return actionFailure("Notification not found.");

    revalidatePath("/notifications");
    return actionSuccess("Marked as read.");
  } catch (error) {
    return toActionFailure(error, "We could not update that notification.");
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Your session expired.", { code: "AUTH_REQUIRED" });

    const count = await markAllNotificationsRead(user.id);
    revalidatePath("/notifications");
    return actionSuccess(count ? `${count} notification${count === 1 ? "" : "s"} marked as read.` : "Nothing to mark as read.");
  } catch (error) {
    return toActionFailure(error, "We could not update your notifications.");
  }
}

export async function deleteNotificationAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return actionFailure("Your session expired.", { code: "AUTH_REQUIRED" });

    const data = normalizeInput(source);
    const notificationId = String(data.notificationId ?? "");
    if (!notificationId) return actionFailure("Missing notification.");

    const removed = await deleteNotification(user.id, notificationId);
    if (!removed) return actionFailure("Notification not found.");

    revalidatePath("/notifications");
    return actionSuccess("Notification removed.");
  } catch (error) {
    return toActionFailure(error, "We could not remove that notification.");
  }
}

/* ------------------------------------------------------------------ contact */

export async function submitContactMessageAction(
  source: FormData | Record<string, unknown>
): Promise<ActionResult> {
  try {
    const parsed = validate(contactSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const user = await getCurrentUser();
    const message = await createContactMessage(parsed.data, user?.id ?? null);

    const admins = await import("@/lib/db/prisma").then(({ prisma }) =>
      prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } })
    );
    const { createNotification } = await import("@/server/services/notifications");
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          type: "MESSAGE",
          title: "New contact message",
          message: `${message.name}: ${message.subject}`,
          link: "/admin/messages",
        })
      )
    );

    revalidatePath("/admin/messages");
    return actionSuccess("Thank you! Your message has been received — we usually reply within one working day.");
  } catch (error) {
    return toActionFailure(error, "We could not send your message. Please try again or call the studio.");
  }
}

/* --------------------------------------------------------------- moderation */

export async function refreshServiceRatingAction(serviceId: string) {
  await recalculateServiceRating(serviceId);
}
