"use client";

/**
 * Drag & drop upload widget.
 *
 * Supports multiple selection, per-file progress, preview, removal and
 * replacement. Files are streamed to /api/upload which validates type + size
 * and forwards them to Cloudinary (or local disk when Cloudinary is not
 * configured). Only metadata comes back to the caller.
 */
import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES, isAllowedMediaType } from "@/lib/constants";

export type UploadedFile = {
  url: string;
  publicId: string | null;
  kind: "image" | "video";
  format: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  originalName: string;
};

type PendingFile = { id: string; name: string; progress: number };

export function ImageUploader({
  kind = "image",
  folder = "gallery",
  multiple = false,
  label,
  accept,
  maxFiles = 12,
  onUploaded,
  className,
}: {
  kind?: "image" | "video";
  folder?: string;
  multiple?: boolean;
  label?: string;
  accept?: string;
  maxFiles?: number;
  onUploaded: (files: UploadedFile[]) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);

  const maxBytes = kind === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
  const defaultAccept = kind === "image" ? "image/jpeg,image/jpg,image/png,image/webp" : "video/mp4,video/webm,video/quicktime";

  /** Rendered client-side for instant feedback; the server re-validates. */
  const validate = useCallback(
    (file: File) => {
      if (!isAllowedMediaType(file.name, file.type, kind)) {
        toast.error(
          kind === "image"
            ? "Only JPG, JPEG, PNG and WEBP images are supported."
            : "Only MP4, WEBM and MOV videos are supported."
        );
        return false;
      }
      if (file.size > maxBytes) {
        toast.error(`That file is too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))} MB.`);
        return false;
      }
      return true;
    },
    [kind, maxBytes]
  );

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length > (multiple ? maxFiles : 1)) {
        toast.error(multiple ? `Please select at most ${maxFiles} files.` : "Please upload one file at a time.");
        return;
      }
      const valid = files.filter(validate);
      if (!valid.length) return;

      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("folder", folder);
      for (const file of valid) formData.append("file", file);

      const tracked: PendingFile[] = valid.map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        name: file.name,
        progress: 8,
      }));
      setPending(tracked);

      // XHR (not fetch) so we can show real upload progress.
      try {
        const response = await new Promise<{ ok: boolean; uploads?: UploadedFile[]; error?: string }>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", "/api/upload");

          request.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const percent = Math.round((event.loaded / event.total) * 100);
            setPending((current) => current.map((item) => ({ ...item, progress: Math.max(item.progress, percent) })));
          };

          request.onload = () => {
            try {
              resolve(JSON.parse(request.responseText));
            } catch {
              reject(new Error("Unexpected response from the server."));
            }
          };
          request.onerror = () => reject(new Error("Network error while uploading."));
          request.send(formData);
        });

        if (!response.ok || !response.uploads) {
          toast.error(response.error ?? "Upload failed. Please try again.");
          return;
        }

        toast.success(
          response.uploads.length > 1
            ? `${response.uploads.length} files uploaded.`
            : `${response.uploads[0].originalName} uploaded.`
        );
        onUploaded(response.uploads);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Upload failed. Please try again.");
      } finally {
        setPending([]);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [folder, kind, maxFiles, multiple, onUploaded, validate]
  );

  const busy = pending.length > 0;

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-label={label ?? `Upload ${kind}`}
        aria-disabled={busy}
        aria-busy={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!busy && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) void upload(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
          dragging ? "border-rosegold bg-blush/60" : "border-line bg-white/60 hover:border-rosegold-soft hover:bg-white",
          busy && "cursor-wait opacity-80"
        )}
      >
        {busy ? <Loader2 size={22} className="animate-spin text-rosegold" /> : <UploadCloud size={22} className="text-rosegold" />}
        <p className="text-sm font-medium">
          {busy ? "Uploading…" : (label ?? (kind === "image" ? "Drag & drop images here" : "Drag & drop a video here"))}
        </p>
        <p className="text-xs text-muted">
          {kind === "image" ? "JPG, PNG or WEBP · up to 8 MB each" : "MP4, WEBM or MOV · up to 60 MB"}
          {multiple ? ` · up to ${maxFiles} files` : ""}
        </p>
        <span className="btn-outline btn-sm mt-1">
          <ImagePlus size={14} />
          Choose {multiple ? "files" : "file"}
        </span>

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          disabled={busy}
          accept={accept ?? defaultAccept}
          multiple={multiple}
          onChange={(event) => void upload(Array.from(event.target.files ?? []))}
        />
      </div>

      {pending.length ? (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {pending.map((file) => (
            <li key={file.id} className="rounded-xl border border-line bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate">{file.name}</span>
                <span className="text-muted">{file.progress}%</span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-cream-deep"
                role="progressbar"
                aria-label={`Upload progress for ${file.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={file.progress}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rosegold to-rosegold-dark transition-all"
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Small preview tile with a remove button, used by the gallery bulk uploader. */
export function UploadPreview({
  file,
  onRemove,
}: {
  file: UploadedFile & { title?: string };
  onRemove: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative aspect-square">
        {file.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={file.originalName} className="h-full w-full object-cover" />
        ) : (
          <video src={file.url} className="h-full w-full object-cover" muted playsInline />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-danger opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Remove ${file.originalName}`}
      >
        <Trash2 size={14} />
      </button>
      {file.title ? <p className="truncate px-2 py-1.5 text-[0.7rem] text-muted">{file.title}</p> : null}
    </div>
  );
}
