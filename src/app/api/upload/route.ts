/**
 * Authenticated media upload endpoint. Customers may upload profile images only;
 * the studio admin can upload managed service, gallery, content and video media.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { IMAGE_MAX_BYTES, MAX_IMAGE_COUNT_PER_UPLOAD, VIDEO_MAX_BYTES } from "@/lib/constants";
import { MediaError, isCloudinaryConfigured, storageKind, uploadMedia } from "@/lib/media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_FOLDERS = new Set(["avatars", "gallery", "services", "videos", "service-videos", "content"]);
const MAX_REQUEST_BYTES = Math.max(MAX_IMAGE_COUNT_PER_UPLOAD * IMAGE_MAX_BYTES, VIDEO_MAX_BYTES) + 1024 * 1024;

async function readBoundedFormData(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new MediaError("Upload requests must use multipart form data.", "INVALID_REQUEST");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new MediaError("The upload is too large.", "TOO_LARGE");
  }
  if (!request.body) throw new MediaError("No upload data was received.", "INVALID_REQUEST");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MediaError("The upload is too large.", "TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = Buffer.concat(chunks, totalBytes);
  try {
    return await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body }).formData();
  } catch {
    throw new MediaError("The upload request is malformed.", "INVALID_REQUEST");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Please sign in to upload files." }, { status: 401 });
    }

    const formData = await readBoundedFormData(request);
    const rawKind = formData.get("kind");
    if (rawKind !== "image" && rawKind !== "video") {
      return NextResponse.json({ ok: false, error: "Choose a supported media type." }, { status: 400 });
    }
    const kind = rawKind;
    const defaultFolder = user.role === "ADMIN" ? "gallery" : "avatars";
    const requestedFolder = String(formData.get("folder") ?? defaultFolder);

    if (!ALLOWED_FOLDERS.has(requestedFolder)) {
      return NextResponse.json({ ok: false, error: "That upload destination is not allowed." }, { status: 400 });
    }
    if (user.role !== "ADMIN" && (kind !== "image" || requestedFolder !== "avatars")) {
      return NextResponse.json({ ok: false, error: "Only administrators may upload studio media." }, { status: 403 });
    }
    const folder = requestedFolder === "avatars" ? `avatars/${user.id}` : requestedFolder;

    const files = formData.getAll("file").filter((entry): entry is File => entry instanceof File);
    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No file was received." }, { status: 400 });
    }
    if (kind === "image" && files.length > MAX_IMAGE_COUNT_PER_UPLOAD) {
      return NextResponse.json(
        { ok: false, error: `Please upload at most ${MAX_IMAGE_COUNT_PER_UPLOAD} images at a time.` },
        { status: 400 }
      );
    }
    if (kind === "video" && files.length !== 1) {
      return NextResponse.json({ ok: false, error: "Upload one video at a time." }, { status: 400 });
    }

    const uploads = [];
    for (const file of files) {
      uploads.push(await uploadMedia(file, { kind, folder }));
    }

    return NextResponse.json({
      ok: true,
      storage: storageKind(),
      uploads: uploads.map((upload) => ({
        url: upload.url,
        publicId: upload.publicId,
        kind: upload.resourceType,
        format: upload.format,
        bytes: upload.bytes,
        width: upload.width,
        height: upload.height,
        durationSeconds: upload.durationSeconds,
        originalName: upload.originalName,
      })),
    });
  } catch (error) {
    if (error instanceof MediaError) {
      const status = error.code === "TOO_LARGE" ? 413 : error.code === "STORAGE_NOT_CONFIGURED" ? 503 : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status });
    }

    console.error("[api/upload] unexpected failure:", error);
    return NextResponse.json(
      {
        ok: false,
        error: isCloudinaryConfigured()
          ? "Upload failed while transferring the file. Please check your connection and try again."
          : "Upload failed. Please try again.",
        code: "UPLOAD_FAILED",
      },
      { status: 500 }
    );
  }
}
