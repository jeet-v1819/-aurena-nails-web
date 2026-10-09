/**
 * Media storage abstraction.
 *
 * Cloudinary is the production storage provider. A local-filesystem fallback is
 * available only outside production so previews and development remain usable
 * without external credentials. Binary files are never stored in PostgreSQL.
 */
import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES, isAllowedMediaType } from "@/lib/constants";

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

export class MediaError extends Error {
  code: string;

  constructor(message: string, code = "MEDIA_ERROR") {
    super(message);
    this.name = "MediaError";
    this.code = code;
  }
}

const UPLOAD_FOLDER_SEGMENT = /^[a-zA-Z0-9_-]+$/;

/** Rejects parent paths and other path-like input before Cloudinary or disk I/O. */
export function sanitizeUploadFolder(folder: string) {
  const segments = folder.replace(/\\/g, "/").split("/");
  if (!segments.length || segments.some((segment) => !UPLOAD_FOLDER_SEGMENT.test(segment))) {
    throw new MediaError("The upload destination is invalid.", "INVALID_FOLDER");
  }
  return segments.join("/");
}

function hasCloudinaryCredentials() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}

export function storageKind(): StorageKind {
  if (hasCloudinaryCredentials()) return "cloudinary";
  if (process.env.NODE_ENV === "production") {
    throw new MediaError("Cloudinary storage is not configured for this production environment.", "STORAGE_NOT_CONFIGURED");
  }
  return "local";
}

export function isCloudinaryConfigured() {
  return hasCloudinaryCredentials();
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

/**
 * Validates file type and size *on the server* — the client-side check is only
 * a convenience. Extension and declared MIME type must agree; uploadMedia also
 * checks the actual file signature before storing anything.
 */
export function validateFile(file: File, kind: "image" | "video") {
  const maxBytes = kind === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;

  if (!file || file.size === 0) {
    throw new MediaError("The file is empty. Please choose another file.", "EMPTY_FILE");
  }

  const mime = (file.type || "").toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!isAllowedMediaType(file.name, mime, kind)) {
    throw new MediaError(
      kind === "image"
        ? "Only matching JPG, JPEG, PNG and WEBP image files are supported."
        : "Only matching MP4, WEBM and MOV video files are supported.",
      "INVALID_TYPE"
    );
  }

  if (file.size > maxBytes) {
    const limit = Math.round(maxBytes / (1024 * 1024));
    throw new MediaError(`That file is too large. The maximum size is ${limit} MB.`, "TOO_LARGE");
  }

  return { extension, mime };
}

function hasExpectedSignature(buffer: Buffer, kind: "image" | "video", extension: string) {
  if (kind === "image") {
    if (extension === "jpg" || extension === "jpeg") {
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (extension === "png") {
      return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (extension === "webp") {
      return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    }
    return false;
  }

  if (extension === "webm") {
    return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }

  if (extension === "mp4" || extension === "mov") {
    if (buffer.length < 12 || buffer.toString("ascii", 4, 8) !== "ftyp") return false;
    const brands = [buffer.toString("ascii", 8, 12)];
    for (let offset = 16; offset + 4 <= Math.min(buffer.length, 64); offset += 4) {
      brands.push(buffer.toString("ascii", offset, offset + 4));
    }
    return extension === "mov" ? brands.includes("qt  ") || brands.some((brand) => brand.startsWith("qt")) : !brands.includes("qt  ");
  }

  return false;
}

/** Uploads a single file and returns metadata to persist. */
export async function uploadMedia(
  file: File,
  options: { folder?: string; kind: "image" | "video" }
): Promise<UploadedMedia> {
  const { extension } = validateFile(file, options.kind);
  const folder = sanitizeUploadFolder(options.folder ?? process.env.CLOUDINARY_FOLDER ?? "aurena-nails");
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!hasExpectedSignature(buffer, options.kind, extension)) {
    throw new MediaError("The file contents do not match its declared image or video type.", "INVALID_CONTENT");
  }

  if (storageKind() === "cloudinary") {
    return uploadToCloudinary(buffer, file, { folder, kind: options.kind });
  }
  return uploadToLocalDisk(buffer, file, { folder, kind: options.kind, extension });
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
 * `/uploads/...` path. It is deliberately disabled for production deployments.
 */
async function uploadToLocalDisk(
  buffer: Buffer,
  file: File,
  options: { folder: string; kind: "image" | "video"; extension: string }
): Promise<UploadedMedia> {
  const { mkdir, writeFile, readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const crypto = await import("node:crypto");

  const baseDirectory = path.resolve(process.cwd(), "public", "uploads");
  const dir = path.resolve(baseDirectory, options.folder);
  if (!dir.startsWith(`${baseDirectory}${path.sep}`)) {
    throw new MediaError("The upload destination is invalid.", "INVALID_FOLDER");
  }
  await mkdir(dir, { recursive: true });

  const base = path
    .basename(file.name, `.${options.extension}`)
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 40)
    .toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${base || "file"}.${options.extension}`;

  await writeFile(path.join(dir, filename), buffer, { flag: "wx" });

  const dimensions = await readImageDimensions(buffer, options.extension);
  const publicPath = `/uploads/${options.folder}/${filename}`;

  // Fail loudly if a write silently produced nothing.
  await readFile(path.join(dir, filename));

  return {
    url: publicPath,
    publicId: `local:${options.folder}/${filename}`,
    resourceType: options.kind,
    format: options.extension,
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

/** Deletes an asset on a best-effort basis. Never exposes provider errors. */
export async function deleteMedia(publicId: string | null | undefined, resourceType: "image" | "video" = "image") {
  if (!publicId) return;

  try {
    if (publicId.startsWith("local:")) {
      const { unlink } = await import("node:fs/promises");
      const path = await import("node:path");
      const baseDirectory = path.resolve(process.cwd(), "public", "uploads");
      const relative = publicId.slice("local:".length).replace(/\\/g, "/");
      const target = path.resolve(baseDirectory, relative);
      if (!target.startsWith(`${baseDirectory}${path.sep}`)) {
        console.warn("[media] refused to delete a local file outside the upload directory");
        return;
      }
      await unlink(target).catch(() => {});
      return;
    }

    if (isCloudinaryConfigured()) {
      await cloudinaryClient().uploader.destroy(publicId, { resource_type: resourceType });
    }
  } catch (error) {
    console.error("[media] failed to delete asset", error);
  }
}
