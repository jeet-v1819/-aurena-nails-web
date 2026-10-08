"use client";

/**
 * Service media: photos (with a main image) and videos with an optional
 * thumbnail. Files upload to Cloudinary (or local disk in development) and only
 * their metadata is stored in PostgreSQL.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Loader2, Star, Trash2, Video } from "lucide-react";
import {
  addServiceImageAction,
  addServiceVideoAction,
  deleteServiceImageAction,
  deleteServiceVideoAction,
  setPrimaryServiceImageAction,
} from "@/server/actions/admin/catalog";
import { ImageUploader, type UploadedFile } from "@/components/ui/image-uploader";
import { ConfirmDialog } from "@/components/ui/interactive";
import { Badge } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { formatFileSize, formatSeconds } from "@/lib/format";

type ServiceImage = { id: string; url: string; alt: string | null; isPrimary: boolean; fileSize: number | null };
type ServiceVideo = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  fileSize: number | null;
};

export function ServiceMediaManager({
  serviceId,
  serviceName,
  images,
  videos,
}: {
  serviceId: string;
  serviceName: string;
  images: ServiceImage[];
  videos: ServiceVideo[];
}) {
  const router = useRouter();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [alt, setAlt] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [pendingVideo, setPendingVideo] = useState<UploadedFile | null>(null);
  const [pendingThumbnail, setPendingThumbnail] = useState<UploadedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "image" | "video"; id: string; label: string } | null>(null);

  const uploadImage = async (files: UploadedFile[]) => {
    const file = files[0];
    if (!file) return;

    setBusy(true);
    for (const uploaded of files) {
      const result = await addServiceImageAction({
        serviceId,
        url: uploaded.url,
        publicId: uploaded.publicId,
        alt: alt || `${serviceName} nail art`,
        width: uploaded.width,
        height: uploaded.height,
        fileSize: uploaded.bytes,
        fileType: uploaded.format,
      });
      notifyResult(result);
    }
    setBusy(false);
    setUploadingImage(false);
    setAlt("");
    router.refresh();
  };

  const uploadVideo = async () => {
    if (!pendingVideo) return;
    setBusy(true);

    const result = await addServiceVideoAction({
      serviceId,
      title: videoTitle || `${serviceName} video`,
      url: pendingVideo.url,
      publicId: pendingVideo.publicId,
      thumbnailUrl: pendingThumbnail?.url,
      thumbnailPublicId: pendingThumbnail?.publicId,
      durationSeconds: pendingVideo.durationSeconds,
      width: pendingVideo.width,
      height: pendingVideo.height,
      fileSize: pendingVideo.bytes,
      format: pendingVideo.format,
    });

    setBusy(false);
    notifyResult(result);

    if (result.ok) {
      setPendingVideo(null);
      setPendingThumbnail(null);
      setVideoTitle("");
      setUploadingVideo(false);
      router.refresh();
    }
  };

  const setPrimary = async (imageId: string) => {
    setBusy(true);
    const result = await setPrimaryServiceImageAction({ serviceId, imageId });
    setBusy(false);
    notifyResult(result);
    if (result.ok) router.refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);

    const result =
      deleteTarget.kind === "image"
        ? await deleteServiceImageAction({ serviceId, imageId: deleteTarget.id })
        : await deleteServiceVideoAction({ serviceId, videoId: deleteTarget.id });

    setBusy(false);
    notifyResult(result);
    setDeleteTarget(null);
    if (result.ok) router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ images */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Photos</h2>
            <p className="mt-1 text-sm text-muted">
              The first photo (marked “Main”) is used on cards and in search results. JPG, PNG or WEBP up to 8 MB.
            </p>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => setUploadingImage((value) => !value)}>
            <ImagePlus size={15} /> {uploadingImage ? "Close uploader" : "Add photos"}
          </button>
        </div>

        {uploadingImage ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-dashed border-nude-dark p-4">
            <label className="block">
              <span className="label">Image description (alt text)</span>
              <input
                className="input mt-2"
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                placeholder={`${serviceName} nail art`}
              />
            </label>
            <ImageUploader kind="image" folder="services" multiple label="Drop photos here or browse" onUploaded={uploadImage} />
          </div>
        ) : null}

        {images.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <li key={image.id} className="group relative overflow-hidden rounded-2xl border border-line bg-nude">
                <span className="relative block aspect-square">
                  <Image src={image.url} alt={image.alt ?? serviceName} fill sizes="200px" className="object-cover" />
                </span>

                {image.isPrimary ? (
                  <span className="absolute left-2 top-2">
                    <Badge tone="gold">Main</Badge>
                  </span>
                ) : null}

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-charcoal/75 p-2 opacity-0 transition group-hover:opacity-100">
                  {!image.isPrimary ? (
                    <button
                      type="button"
                      className="rounded-full bg-white/90 p-1.5 text-charcoal"
                      aria-label="Set as main image"
                      disabled={busy}
                      onClick={() => setPrimary(image.id)}
                    >
                      <Star size={14} />
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="rounded-full bg-white/90 p-1.5 text-danger"
                    aria-label="Delete image"
                    onClick={() => setDeleteTarget({ kind: "image", id: image.id, label: "this photo" })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {image.fileSize ? (
                  <p className="absolute bottom-0 left-0 right-0 hidden bg-charcoal/70 px-2 py-1 text-[0.65rem] text-white group-hover:hidden">
                    {formatFileSize(image.fileSize)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-xl bg-cream-deep p-4 text-sm text-muted">
            No photos yet — upload at least one so the service looks complete on the website.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------ videos */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Videos</h2>
            <p className="mt-1 text-sm text-muted">MP4, WEBM or MOV up to 60 MB, with an optional thumbnail image.</p>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => setUploadingVideo((value) => !value)}>
            <Video size={15} /> {uploadingVideo ? "Close uploader" : "Add video"}
          </button>
        </div>

        {uploadingVideo ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-dashed border-nude-dark p-4">
            <label className="block">
              <span className="label">Video title</span>
              <input
                className="input mt-2"
                value={videoTitle}
                onChange={(event) => setVideoTitle(event.target.value)}
                placeholder="Chrome French in 60 seconds"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label">Video file</p>
                <div className="mt-2">
                  <ImageUploader kind="video" folder="service-videos" label="Upload the video" onUploaded={(files) => setPendingVideo(files[0] ?? null)} />
                </div>
                {pendingVideo ? (
                  <p className="mt-2 text-xs text-success">
                    Ready: {pendingVideo.originalName} ({formatFileSize(pendingVideo.bytes)}
                    {pendingVideo.durationSeconds ? `, ${formatSeconds(pendingVideo.durationSeconds)}` : ""})
                  </p>
                ) : null}
              </div>

              <div>
                <p className="label">Thumbnail (optional)</p>
                <div className="mt-2">
                  <ImageUploader kind="image" folder="service-videos" label="Upload a poster image" onUploaded={(files) => setPendingThumbnail(files[0] ?? null)} />
                </div>
                {pendingThumbnail ? <p className="mt-2 text-xs text-success">Thumbnail ready.</p> : null}
              </div>
            </div>

            <button type="button" className="btn-primary btn-sm" disabled={!pendingVideo || busy} onClick={uploadVideo}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />} Save video
            </button>
          </div>
        ) : null}

        {videos.length ? (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {videos.map((video) => (
              <li key={video.id} className="flex gap-3 rounded-2xl border border-line bg-white p-3">
                <video
                  src={video.url}
                  poster={video.thumbnailUrl ?? undefined}
                  controls
                  preload="metadata"
                  className="h-24 w-36 shrink-0 rounded-xl bg-charcoal object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{video.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {video.durationSeconds ? formatSeconds(video.durationSeconds) : "Duration unknown"}
                    {video.fileSize ? ` · ${formatFileSize(video.fileSize)}` : ""}
                  </p>
                  <button
                    type="button"
                    className="btn-ghost btn-sm mt-2 text-danger"
                    onClick={() => setDeleteTarget({ kind: "video", id: video.id, label: video.title })}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-xl bg-cream-deep p-4 text-sm text-muted">No videos attached to this service yet.</p>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === "image" ? "Delete this photo?" : "Delete this video?"}
        message={`“${deleteTarget?.label ?? ""}” will be removed from the service and deleted from media storage. This cannot be undone.`}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
