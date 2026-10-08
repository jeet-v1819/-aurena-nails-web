"use server";

/** Admin actions for gallery, videos, website content, hours, holidays and settings. */
import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/lib/auth/session";
import { actionFailure, actionSuccess, toActionFailure, type ActionResult } from "@/lib/errors";
import { normalizeInput, timeStringToMinutes, validate } from "@/lib/validation";
import {
  businessHoursListSchema,
  contentUpdateSchema,
  galleryImageSchema,
  holidaySchema,
  settingsSchema,
  videoSchema,
} from "@/validators/admin";
import {
  createGalleryImage,
  createGalleryImages,
  deleteGalleryImage,
  setGalleryImageFlags,
  updateGalleryImage,
} from "@/server/services/gallery";
import { createVideo, deleteVideo, setVideoFlags, updateVideo } from "@/server/services/videos";
import { updateBusinessHours, createHoliday, updateHoliday, deleteHoliday } from "@/server/services/business-hours";
import { updateContent } from "@/server/services/content";
import { deleteMedia } from "@/lib/media/storage";

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

/* ------------------------------------------------------------------ gallery */

export async function createGalleryImageAction(source: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const parsed = validate(galleryImageSchema, source);
    if (!parsed.success) return parsed.failure;

    const image = await createGalleryImage(guard.admin.id, {
      ...parsed.data,
      description: parsed.data.description,
      publicId: parsed.data.publicId || undefined,
      format: parsed.data.format || undefined,
    });

    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    revalidatePath("/");
    return actionSuccess("Design added to the gallery.", { id: image.id });
  } catch (error) {
    return toActionFailure(error, "We could not save that design. Please try again.");
  }
}

/** Multiple files uploaded at once: `items` comes from the upload widget. */
export async function createGalleryImagesAction(source: {
  items: Array<Record<string, unknown>>;
  defaults: { categoryId: string; tags: string[]; style?: string; occasion?: string; isActive: boolean; isFeatured: boolean };
}): Promise<ActionResult<{ created: number }>> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    if (!source.items?.length) return actionFailure("Upload at least one image.");

    const inputs: Array<Parameters<typeof createGalleryImages>[1][number]> = [];
    for (const [index, raw] of source.items.entries()) {
      const parsed = validate(galleryImageSchema, {
        ...raw,
        categoryId: raw.categoryId || source.defaults.categoryId,
        tags: raw.tags ?? source.defaults.tags,
        style: raw.style ?? source.defaults.style,
        occasion: raw.occasion ?? source.defaults.occasion,
        isActive: raw.isActive ?? source.defaults.isActive,
        isFeatured: raw.isFeatured ?? source.defaults.isFeatured,
        sortOrder: index,
      });
      if (!parsed.success) return parsed.failure;
      inputs.push({
        ...parsed.data,
        publicId: parsed.data.publicId || undefined,
        format: parsed.data.format || undefined,
      });
    }

    const created = await createGalleryImages(guard.admin.id, inputs, source.defaults);

    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    revalidatePath("/");
    return actionSuccess(`${created.length} design${created.length === 1 ? "" : "s"} added to the gallery.`, {
      created: created.length,
    });
  } catch (error) {
    return toActionFailure(error, "We could not save those designs. Please try again.");
  }
}

export async function updateGalleryImageAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const imageId = String(source.imageId ?? "");
    if (!imageId) return actionFailure("Missing gallery item.");

    const parsed = validate(galleryImageSchema, source);
    if (!parsed.success) return parsed.failure;

    await updateGalleryImage(guard.admin.id, imageId, {
      ...parsed.data,
      publicId: parsed.data.publicId || undefined,
      format: parsed.data.format || undefined,
    });

    revalidatePath("/admin/gallery");
    revalidatePath(`/gallery/${imageId}`);
    revalidatePath("/gallery");
    return actionSuccess("Design updated successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not update that design.");
  }
}

export async function galleryFlagsAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const imageId = String(source.imageId ?? "");
    if (!imageId) return actionFailure("Missing gallery item.");

    await setGalleryImageFlags(guard.admin.id, imageId, {
      ...(source.isActive !== undefined ? { isActive: source.isActive === true || source.isActive === "true" } : {}),
      ...(source.isFeatured !== undefined ? { isFeatured: source.isFeatured === true || source.isFeatured === "true" } : {}),
    });

    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    return actionSuccess("Design updated.");
  } catch (error) {
    return toActionFailure(error, "We could not update that design.");
  }
}

export async function deleteGalleryImageAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const imageId = String(source.imageId ?? "");
    if (!imageId) return actionFailure("Missing gallery item.");

    const result = await deleteGalleryImage(guard.admin.id, imageId);
    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    return actionSuccess(result.message);
  } catch (error) {
    return toActionFailure(error, "We could not delete that design.");
  }
}

/* ------------------------------------------------------------------- videos */

export async function createVideoAction(source: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const parsed = validate(videoSchema, source);
    if (!parsed.success) return parsed.failure;

    const video = await createVideo(guard.admin.id, {
      ...parsed.data,
      publicId: parsed.data.publicId || undefined,
      thumbnailUrl: parsed.data.thumbnailUrl || undefined,
      thumbnailPublicId: parsed.data.thumbnailPublicId || undefined,
      format: parsed.data.format || undefined,
    });

    revalidatePath("/admin/videos");
    revalidatePath("/videos");
    revalidatePath("/");
    return actionSuccess("Video published successfully.", { id: video.id });
  } catch (error) {
    return toActionFailure(error, "We could not publish that video. Please try again.");
  }
}

export async function updateVideoAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const videoId = String(source.videoId ?? "");
    if (!videoId) return actionFailure("Missing video.");

    const parsed = validate(videoSchema, source);
    if (!parsed.success) return parsed.failure;

    await updateVideo(guard.admin.id, videoId, {
      ...parsed.data,
      publicId: parsed.data.publicId || undefined,
      thumbnailUrl: parsed.data.thumbnailUrl || undefined,
      thumbnailPublicId: parsed.data.thumbnailPublicId || undefined,
      format: parsed.data.format || undefined,
    });

    revalidatePath("/admin/videos");
    revalidatePath(`/videos/${videoId}`);
    revalidatePath("/videos");
    return actionSuccess("Video updated successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not update that video.");
  }
}

export async function videoFlagsAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const videoId = String(source.videoId ?? "");
    if (!videoId) return actionFailure("Missing video.");

    await setVideoFlags(guard.admin.id, videoId, {
      ...(source.isActive !== undefined ? { isActive: source.isActive === true || source.isActive === "true" } : {}),
      ...(source.isFeatured !== undefined ? { isFeatured: source.isFeatured === true || source.isFeatured === "true" } : {}),
    });

    revalidatePath("/admin/videos");
    revalidatePath("/videos");
    return actionSuccess("Video updated.");
  } catch (error) {
    return toActionFailure(error, "We could not update that video.");
  }
}

export async function deleteVideoAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const videoId = String(source.videoId ?? "");
    if (!videoId) return actionFailure("Missing video.");

    const video = await import("@/lib/db/prisma").then(({ prisma }) =>
      prisma.video.findUnique({ where: { id: videoId }, select: { thumbnailPublicId: true } })
    );

    await deleteVideo(guard.admin.id, videoId);
    if (video?.thumbnailPublicId) await deleteMedia(video.thumbnailPublicId, "image");

    revalidatePath("/admin/videos");
    revalidatePath("/videos");
    return actionSuccess("Video deleted.");
  } catch (error) {
    return toActionFailure(error, "We could not delete that video.");
  }
}

/* --------------------------------------------------------- website content */

export async function updateContentAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const values = (source.values ?? {}) as Record<string, string>;
    const parsed = validate(contentUpdateSchema, values);
    if (!parsed.success) return parsed.failure;

    await updateContent(parsed.data);

    revalidatePath("/", "layout");
    revalidatePath("/admin/content");
    return actionSuccess("Website content updated successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not save the website content.");
  }
}

/** General settings live in the same key/value store, typed for the settings form. */
export async function updateSettingsAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const parsed = validate(settingsSchema, source);
    if (!parsed.success) return parsed.failure;

    await updateContent({
      "site.name": parsed.data.siteName,
      "site.tagline": parsed.data.tagline,
      "site.seoDescription": parsed.data.seoDescription,
      "site.footerNote": parsed.data.footerNote || "",
      "booking.slotIntervalMinutes": String(parsed.data.slotIntervalMinutes),
      "booking.minLeadMinutes": String(parsed.data.minLeadMinutes),
      "booking.maxAdvanceDays": String(parsed.data.maxAdvanceDays),
      "booking.cancellationWindowHours": String(parsed.data.cancellationWindowHours),
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return actionSuccess("Settings saved successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not save the settings.");
  }
}

/* -------------------------------------------------------- business hours */

export async function updateBusinessHoursAction(source: {
  days: Array<Record<string, unknown>>;
}): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const normalized = (source.days ?? []).map((day) => {
      const openMinutes =
        typeof day.openMinutes === "number" ? day.openMinutes : timeStringToMinutes(String(day.openTime ?? "")) ?? 600;
      const closeMinutes =
        typeof day.closeMinutes === "number" ? day.closeMinutes : timeStringToMinutes(String(day.closeTime ?? "")) ?? 1140;
      const breakStart =
        day.breakStartTime && String(day.breakStartTime)
          ? timeStringToMinutes(String(day.breakStartTime)) ?? undefined
          : undefined;
      const breakEnd =
        day.breakEndTime && String(day.breakEndTime)
          ? timeStringToMinutes(String(day.breakEndTime)) ?? undefined
          : undefined;

      return {
        dayOfWeek: Number(day.dayOfWeek),
        isOpen: day.isOpen === true || day.isOpen === "true",
        openMinutes,
        closeMinutes,
        breakStartMinutes: breakStart,
        breakEndMinutes: breakEnd,
        slotIntervalMinutes: day.slotIntervalMinutes ? Number(day.slotIntervalMinutes) : undefined,
        note: day.note ? String(day.note) : undefined,
      };
    });

    const parsed = validate(businessHoursListSchema, normalized);
    if (!parsed.success) return parsed.failure;

    await updateBusinessHours(guard.admin.id, parsed.data);

    revalidatePath("/admin/business-hours");
    revalidatePath("/booking");
    revalidatePath("/contact");
    revalidatePath("/");
    return actionSuccess("Business hours updated successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not save the business hours.");
  }
}

/* ---------------------------------------------------------------- holidays */

export async function createHolidayAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const parsed = validate(holidaySchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
    await createHoliday(guard.admin.id, {
      name: parsed.data.name,
      date,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
    });

    revalidatePath("/admin/holidays");
    revalidatePath("/booking");
    return actionSuccess("Holiday added successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not add that holiday.");
  }
}

export async function updateHolidayAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const holidayId = String(data.holidayId ?? "");
    if (!holidayId) return actionFailure("Missing holiday.");

    const parsed = validate(holidaySchema, data);
    if (!parsed.success) return parsed.failure;

    await updateHoliday(guard.admin.id, holidayId, {
      name: parsed.data.name,
      date: new Date(`${parsed.data.date}T00:00:00.000Z`),
      description: parsed.data.description,
      isActive: parsed.data.isActive,
    });

    revalidatePath("/admin/holidays");
    revalidatePath("/booking");
    return actionSuccess("Holiday updated successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not update that holiday.");
  }
}

export async function deleteHolidayAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const holidayId = String(data.holidayId ?? "");
    if (!holidayId) return actionFailure("Missing holiday.");

    await deleteHoliday(guard.admin.id, holidayId);
    revalidatePath("/admin/holidays");
    revalidatePath("/booking");
    return actionSuccess("Holiday removed.");
  } catch (error) {
    return toActionFailure(error, "We could not remove that holiday.");
  }
}
