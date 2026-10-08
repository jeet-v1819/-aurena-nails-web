/**
 * Media storage abstraction.
 *
 *   Cloudinary  → used whenever CLOUDINARY_* credentials are configured
 *   Local disk  → automatic fallback (./public/uploads) so development,
 *                 previews and tests work without any external account
 *
 * Only metadata (URL, public id, size, dimensions, duration) is stored in
 * PostgreSQL; the file itself never touches the database.
 */
import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/constants";

export type StorageKind = "cloudinary" | "local";

export type UploadedMedia = {
  url: string;
  publicId: string | null;
  resourceType: "image" | "video";
  format: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  originalName: string;
  storage: StorageKind;
};

export function storageKind(): StorageKind {
  const configured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
  return configured ? "cloudinary" : "local";
}

export function isCloudinaryConfigured() {
  return storageKind() === "cloudinary";
}

let cloudinaryReady = false;

function cloudinaryClient() {
  if (!cloudinaryReady) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    cloudinaryReady = true;
  }
  return cloudinary;
}

export class MediaError extends Error {
  code: string;

  constructor(message: string, code = "MEDIA_ERROR") {
    super(message);
    this.name = "MediaError";
    this.code = code;
  }
}

/**
 * Validates file type and size *on the server* — the client-side check is only
 * a convenience and can always be bypassed.
 */
export function validateFile(file: File, kind: "image" | "video") {
  const allowed: readonly string[] = kind === "image" ? IMAGE_TYPES : VIDEO_TYPES;
  const maxBytes = kind === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;

  if (!file || file.size === 0) {
    throw new MediaError("The file is empty. Please choose another file.", "EMPTY_FILE");
  }

  const mime = (file.type || "").toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extensionAllowed =
    kind === "image" ? ["jpg", "jpeg", "png", "webp"].includes(extension) : ["mp4", "webm", "mov"].includes(extension);

  if (!allowed.includes(mime) && !extensionAllowed) {
    throw new MediaError(
      kind === "image"
        ? "Only JPG, JPEG, PNG and WEBP images are supported."
        : "Only MP4, WEBM and MOV videos are supported.",
      "INVALID_TYPE"
    );
  }

  if (file.size > maxBytes) {
    const limit = Math.round(maxBytes / (1024 * 1024));
    throw new MediaError(`That file is too large. The maximum size is ${limit} MB.`, "TOO_LARGE");
  }
}

/** Uploads a single file and returns the metadata to persist. */
export async function uploadMedia(
  file: File,
  options: { folder?: string; kind: "image" | "video" }
): Promise<UploadedMedia> {
  validateFile(file, options.kind);

  const folder = options.folder ?? process.env.CLOUDINARY_FOLDER ?? "aurena-nails";
  const buffer = Buffer.from(await file.arrayBuffer());

  if (storageKind() === "cloudinary") {
    return uploadToCloudinary(buffer, file, { folder, kind: options.kind });
  }
  return uploadToLocalDisk(buffer, file, { folder, kind: options.kind });
}

async function uploadToCloudinary(
  buffer: Buffer,
  file: File,
  options: { folder: string; kind: "image" | "video" }
): Promise<UploadedMedia> {
  const client = cloudinaryClient();

  try {
    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const stream = client.uploader.upload_stream(
        {
          folder: options.folder,
          resource_type: options.kind,
          // Reasonable delivery transformations: keeps pages fast without
          // touching the stored original.
          transformation:
            options.kind === "image"
              ? [{ width: 1600, crop: "limit" }, { quality: "auto:good" }, { fetch_format: "auto" }]
              : undefined,
        },
        (error, uploaded) => {
          if (error || !uploaded) reject(error ?? new Error("Cloudinary returned no result"));
          else resolve(uploaded as Record<string, unknown>);
        }
      );
      stream.end(buffer);
    });

    return {
      url: String(result.secure_url),
      publicId: (result.public_id as string) ?? null,
      resourceType: options.kind,
      format: (result.format as string) ?? null,
      bytes: Number(result.bytes ?? file.size),
      width: result.width ? Number(result.width) : null,
      height: result.height ? Number(result.height) : null,
      durationSeconds: result.duration ? Math.round(Number(result.duration)) : null,
      originalName: file.name,
      storage: "cloudinary",
    };
  } catch (error) {
    console.error("[media] Cloudinary upload failed:", error);
    throw new MediaError(
      "Upload failed while transferring the file to Cloudinary. Please check your connection and try again.",
      "UPLOAD_FAILED"
    );
  }
}

/**
 * Local fallback: writes into `public/uploads/<folder>` and returns a public
 * `/uploads/...` path. Used for development and for the offline preview
 * environment, where Cloudinary credentials are intentionally absent.
 */
async function uploadToLocalDisk(
  buffer: Buffer,
  file: File,
  options: { folder: string; kind: "image" | "video" }
): Promise<UploadedMedia> {
  const { mkdir, writeFile, readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const crypto = await import("node:crypto");

  const safeFolder = options.folder.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+/, "") || "uploads";
  const dir = path.join(process.cwd(), "public", "uploads", safeFolder);
  await mkdir(dir, { recursive: true });

  const extension = (file.name.split(".").pop() || (options.kind === "image" ? "jpg" : "mp4")).toLowerCase();
  const base = path
    .basename(file.name, `.${extension}`)
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 40)
    .toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${base || "file"}.${extension}`;

  await writeFile(path.join(dir, filename), buffer);

  const dimensions = await readImageDimensions(buffer, extension);
  const publicPath = `/uploads/${safeFolder}/${filename}`;

  // Fail loudly if a write silently produced nothing.
  await readFile(path.join(dir, filename));

  return {
    url: publicPath,
    publicId: `local:${safeFolder}/${filename}`,
    resourceType: options.kind,
    format: extension,
    bytes: buffer.byteLength,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    durationSeconds: null,
    originalName: file.name,
    storage: "local",
  };
}

/** Reads PNG/JPEG/WEBP header dimensions without an image library. */
async function readImageDimensions(buffer: Buffer, extension: string) {
  try {
    if (extension === "png") {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (extension === "webp") {
      const riff = buffer.toString("ascii", 0, 4);
      const format = buffer.toString("ascii", 8, 12);
      if (riff === "RIFF" && format === "WEBP") {
        const type = buffer.toString("ascii", 12, 16);
        if (type === "VP8X") {
          const width = 1 + (buffer.readUIntLE(24, 3) & 0xffffff);
          const height = 1 + (buffer.readUIntLE(27, 3) & 0xffffff);
          return { width, height };
        }
      }
      return null;
    }
    if (extension === "jpg" || extension === "jpeg") {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Deletes a previously uploaded asset. Never throws — cleanup is best effort. */
export async function deleteMedia(publicId: string | null | undefined, resourceType: "image" | "video" = "image") {
  if (!publicId) return;

  try {
    if (publicId.startsWith("local:")) {
      const { unlink } = await import("node:fs/promises");
      const path = await import("node:path");
      const relative = publicId.replace(/^local:/, "").replace(/^\/+/, "");
      await unlink(path.join(process.cwd(), "public", "uploads", relative)).catch(() => {});
      return;
    }

    if (storageKind() === "cloudinary") {
      await cloudinaryClient().uploader.destroy(publicId, { resource_type: resourceType });
    }
  } catch (error) {
    console.error("[media] failed to delete asset", publicId, error);
  }
}
