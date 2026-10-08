"use server";

/** Admin actions for services, categories and per-service media. */
import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/lib/auth/session";
import { actionFailure, actionSuccess, toActionFailure, type ActionResult } from "@/lib/errors";
import { normalizeInput, validate } from "@/lib/validation";
import { categorySchema, serviceSchema } from "@/validators/admin";
import {
  addServiceImage,
  addServiceVideo,
  createCategory,
  createService,
  deleteCategory,
  deleteService,
  deleteServiceImage,
  deleteServiceVideo,
  setPrimaryServiceImage,
  setServiceFlags,
  updateCategory,
  updateService,
} from "@/server/services/catalog";
import { deleteMedia } from "@/lib/media/storage";

async function requireAdminOrFail() {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false as const, failure: actionFailure("You need to be signed in as an administrator.", { code: "FORBIDDEN" }) };
  return { ok: true as const, admin };
}

/* ------------------------------------------------------------------ services */

export async function createServiceAction(source: FormData | Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const parsed = validate(serviceSchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    const service = await createService(guard.admin.id, parsed.data);
    revalidatePath("/admin/services");
    revalidatePath("/services");
    revalidatePath("/");
    return actionSuccess("Service created successfully.", { id: service.id });
  } catch (error) {
    return toActionFailure(error, "We could not create that service. Please try again.");
  }
}

export async function updateServiceAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const serviceId = String(data.serviceId ?? "");
    if (!serviceId) return actionFailure("Missing service.");

    const parsed = validate(serviceSchema, data);
    if (!parsed.success) return parsed.failure;

    await updateService(guard.admin.id, serviceId, parsed.data);
    revalidatePath("/admin/services");
    revalidatePath(`/admin/services/${serviceId}`);
    revalidatePath("/services");
    revalidatePath("/");
    return actionSuccess("Service updated successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not update that service. Please try again.");
  }
}

export async function serviceFlagsAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const serviceId = String(data.serviceId ?? "");
    if (!serviceId) return actionFailure("Missing service.");

    await setServiceFlags(guard.admin.id, serviceId, {
      ...(data.isActive !== undefined ? { isActive: data.isActive === true || data.isActive === "true" } : {}),
      ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured === true || data.isFeatured === "true" } : {}),
      ...(data.isAvailable !== undefined ? { isAvailable: data.isAvailable === true || data.isAvailable === "true" } : {}),
    });

    revalidatePath("/admin/services");
    revalidatePath("/services");
    return actionSuccess("Service updated.");
  } catch (error) {
    return toActionFailure(error, "We could not update that service.");
  }
}

export async function deleteServiceAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const serviceId = String(data.serviceId ?? "");
    if (!serviceId) return actionFailure("Missing service.");

    const result = await deleteService(guard.admin.id, serviceId);
    revalidatePath("/admin/services");
    revalidatePath("/services");
    return actionSuccess(result.message);
  } catch (error) {
    return toActionFailure(error, "We could not delete that service.");
  }
}

/* --------------------------------------------------------------- categories */

export async function createCategoryAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const parsed = validate(categorySchema, normalizeInput(source));
    if (!parsed.success) return parsed.failure;

    await createCategory(guard.admin.id, parsed.data);
    revalidatePath("/admin/categories");
    revalidatePath("/gallery");
    revalidatePath("/services");
    return actionSuccess("Category created successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not create that category.");
  }
}

export async function updateCategoryAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const categoryId = String(data.categoryId ?? "");
    if (!categoryId) return actionFailure("Missing category.");

    const parsed = validate(categorySchema, data);
    if (!parsed.success) return parsed.failure;

    await updateCategory(guard.admin.id, categoryId, parsed.data);
    revalidatePath("/admin/categories");
    revalidatePath("/gallery");
    revalidatePath("/services");
    return actionSuccess("Category updated successfully.");
  } catch (error) {
    return toActionFailure(error, "We could not update that category.");
  }
}

export async function deleteCategoryAction(source: FormData | Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const data = normalizeInput(source);
    const categoryId = String(data.categoryId ?? "");
    if (!categoryId) return actionFailure("Missing category.");

    const result = await deleteCategory(guard.admin.id, categoryId);
    if (!result.ok) return actionFailure(result.error);

    revalidatePath("/admin/categories");
    return actionSuccess("Category deleted.");
  } catch (error) {
    return toActionFailure(error, "We could not delete that category.");
  }
}

/* ----------------------------------------------------------- service media */

export async function addServiceImageAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const serviceId = String(source.serviceId ?? "");
    const url = String(source.url ?? "");
    if (!serviceId || !url) return actionFailure("Upload an image first.");

    await addServiceImage(guard.admin.id, serviceId, {
      url,
      publicId: source.publicId ? String(source.publicId) : undefined,
      alt: source.alt ? String(source.alt) : undefined,
      width: source.width ? Number(source.width) : undefined,
      height: source.height ? Number(source.height) : undefined,
      fileSize: source.fileSize ? Number(source.fileSize) : undefined,
      fileType: source.fileType ? String(source.fileType) : undefined,
    });

    revalidatePath(`/admin/services/${serviceId}`);
    revalidatePath("/services");
    return actionSuccess("Image added to the service.");
  } catch (error) {
    return toActionFailure(error, "We could not attach that image.");
  }
}

export async function setPrimaryServiceImageAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const serviceId = String(source.serviceId ?? "");
    const imageId = String(source.imageId ?? "");
    if (!serviceId || !imageId) return actionFailure("Missing image.");

    await setPrimaryServiceImage(guard.admin.id, serviceId, imageId);
    revalidatePath(`/admin/services/${serviceId}`);
    revalidatePath("/services");
    return actionSuccess("Main image updated.");
  } catch (error) {
    return toActionFailure(error, "We could not update the main image.");
  }
}

export async function deleteServiceImageAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const imageId = String(source.imageId ?? "");
    const serviceId = String(source.serviceId ?? "");
    if (!imageId) return actionFailure("Missing image.");

    const image = await deleteServiceImage(guard.admin.id, imageId);
    await deleteMedia(image.publicId, "image");

    revalidatePath(`/admin/services/${serviceId}`);
    revalidatePath("/services");
    return actionSuccess("Image removed.");
  } catch (error) {
    return toActionFailure(error, "We could not remove that image.");
  }
}

export async function addServiceVideoAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const serviceId = String(source.serviceId ?? "");
    const url = String(source.url ?? "");
    const title = String(source.title ?? "Service video");
    if (!serviceId || !url) return actionFailure("Upload a video first.");

    await addServiceVideo(guard.admin.id, serviceId, {
      title,
      url,
      publicId: source.publicId ? String(source.publicId) : undefined,
      thumbnailUrl: source.thumbnailUrl ? String(source.thumbnailUrl) : undefined,
      thumbnailPublicId: source.thumbnailPublicId ? String(source.thumbnailPublicId) : undefined,
      durationSeconds: source.durationSeconds ? Number(source.durationSeconds) : null,
      width: source.width ? Number(source.width) : null,
      height: source.height ? Number(source.height) : null,
      fileSize: source.fileSize ? Number(source.fileSize) : null,
      format: source.format ? String(source.format) : null,
    });

    revalidatePath(`/admin/services/${serviceId}`);
    revalidatePath("/services");
    return actionSuccess("Video added to the service.");
  } catch (error) {
    return toActionFailure(error, "We could not attach that video.");
  }
}

export async function deleteServiceVideoAction(source: Record<string, unknown>): Promise<ActionResult> {
  try {
    const guard = await requireAdminOrFail();
    if (!guard.ok) return guard.failure;

    const videoId = String(source.videoId ?? "");
    const serviceId = String(source.serviceId ?? "");
    if (!videoId) return actionFailure("Missing video.");

    const video = await deleteServiceVideo(guard.admin.id, videoId);
    await deleteMedia(video.publicId, "video");
    await deleteMedia(video.thumbnailPublicId, "image");

    revalidatePath(`/admin/services/${serviceId}`);
    return actionSuccess("Video removed.");
  } catch (error) {
    return toActionFailure(error, "We could not remove that video.");
  }
}
