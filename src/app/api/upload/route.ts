/**
 * Media upload endpoint.
 *
 * Any authenticated admin or customer (avatars) can POST a multipart form with
 * one or more `file` entries. Files are validated server-side (type + size),
 * then streamed to Cloudinary — or to local disk when Cloudinary is not
 * configured. Only the returned metadata is persisted by the caller.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { MAX_IMAGE_COUNT_PER_UPLOAD } from "@/lib/constants";
import { MediaError, isCloudinaryConfigured, storageKind, uploadMedia } from "@/lib/media/storage";

export const runtime = "nodejs";
// Uploads are never cached, and large videos need head-room.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Please sign in to upload files." }, { status: 401 });
    }

    const formData = await request.formData();
    const kind = formData.get("kind") === "video" ? "video" : "image";
    const folder = String(formData.get("folder") ?? (user.role === "ADMIN" ? "gallery" : "avatars"));
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
      const status = error.code === "TOO_LARGE" ? 413 : 400;
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
