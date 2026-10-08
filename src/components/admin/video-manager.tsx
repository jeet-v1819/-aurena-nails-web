"use client";

/** Studio videos: upload one at a time with an optional poster image, then edit, feature or delete. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, Eye, EyeOff, Loader2, Pencil, Play, Star, Trash2, Upload } from "lucide-react";
import {
  createVideoAction,
  deleteVideoAction,
  updateVideoAction,
  videoFlagsAction,
} from "@/server/actions/admin/content";
import { ImageUploader, type UploadedFile } from "@/components/ui/image-uploader";
import { ConfirmDialog, Modal } from "@/components/ui/interactive";
import { Alert, Badge } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { formatFileSize, formatSeconds } from "@/lib/format";

export type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  publicId: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  format: string | null;
  tags: string[];
  isFeatured: boolean;
  isActive: boolean;
  viewCount: number;
  publishedAt: Date;
  category: { id: string; name: string };
};

export function VideoManager({
  videos,
  categories,
}: {
  videos: VideoRow[];
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [thumbnail, setThumbnail] = useState<UploadedFile | null>(null);
  const [meta, setMeta] = useState({
    title: "",
    description: "",
    tags: "",
    categoryId: categories[0]?.id ?? "",
    isFeatured: false,
    isActive: true,
  });

  const [editing, setEditing] = useState<VideoRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);

    const result = await createVideoAction({
      title: meta.title || file.originalName,
      description: meta.description,
      categoryId: meta.categoryId,
      url: file.url,
      publicId: file.publicId,
      thumbnailUrl: thumbnail?.url ?? "",
      thumbnailPublicId: thumbnail?.publicId ?? "",
      durationSeconds: file.durationSeconds ?? undefined,
      width: file.width ?? undefined,
      height: file.height ?? undefined,
      fileSize: file.bytes,
      format: file.format ?? undefined,
      tags: meta.tags,
      isFeatured: meta.isFeatured,
      isActive: meta.isActive,
    });

    setBusy(false);
    notifyResult(result);

    if (result.ok) {
      setFile(null);
      setThumbnail(null);
      setMeta({ title: "", description: "", tags: "", categoryId: categories[0]?.id ?? "", isFeatured: false, isActive: true });
      setUploadOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const toggleFlag = async (video: VideoRow, flag: "isActive" | "isFeatured") => {
    setBusy(true);
    const result = await videoFlagsAction({ videoId: video.id, [flag]: !video[flag] });
    setBusy(false);
    notifyResult(result);
    if (result.ok) router.refresh();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteVideoAction({ videoId: deleteTarget.id });
    setBusy(false);
    notifyResult(result);
    setDeleteTarget(null);
    if (result.ok) router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Publish a video</h2>
            <p className="mt-1 text-sm text-muted">MP4, WEBM or MOV up to 60 MB. A poster image is optional but recommended.</p>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={() => setUploadOpen((value) => !value)}>
            <Upload size={15} /> {uploadOpen ? "Close" : "Upload video"}
          </button>
        </div>

        {uploadOpen ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-dashed border-nude-dark p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="min-w-0">
                <span className="label">Title</span>
                <input
                  className="input mt-2"
                  value={meta.title}
                  onChange={(event) => setMeta({ ...meta, title: event.target.value })}
                  placeholder="Bridal French set, step by step"
                />
              </label>
              <label className="min-w-0">
                <span className="label">Collection</span>
                <select
                  className="select mt-2"
                  value={meta.categoryId}
                  onChange={(event) => setMeta({ ...meta, categoryId: event.target.value })}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="label">Description</span>
              <textarea
                className="textarea mt-2 min-h-[90px]"
                value={meta.description}
                onChange={(event) => setMeta({ ...meta, description: event.target.value })}
              />
            </label>

            <label className="block">
              <span className="label">Tags (comma separated)</span>
              <input
                className="input mt-2"
                value={meta.tags}
                onChange={(event) => setMeta({ ...meta, tags: event.target.value })}
                placeholder="bridal, process, french"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label">Video file</p>
                <div className="mt-2">
                  <ImageUploader
                    kind="video"
                    folder="videos"
                    label="Upload the video"
                    onUploaded={(files) => setFile(files[0] ?? null)}
                  />
                </div>
                {file ? (
                  <p className="mt-2 text-xs text-success">
                    Ready: {file.originalName} ({formatFileSize(file.bytes)}
                    {file.durationSeconds ? `, ${formatSeconds(file.durationSeconds)}` : ""})
                  </p>
                ) : null}
              </div>

              <div>
                <p className="label">Thumbnail (optional)</p>
                <div className="mt-2">
                  <ImageUploader kind="image" folder="videos" label="Upload a poster image" onUploaded={(files) => setThumbnail(files[0] ?? null)} />
                </div>
                {thumbnail ? <p className="mt-2 text-xs text-success">Thumbnail ready.</p> : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-rosegold)]"
                  checked={meta.isActive}
                  onChange={(event) => setMeta({ ...meta, isActive: event.target.checked })}
                />
                Publish immediately
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-rosegold)]"
                  checked={meta.isFeatured}
                  onChange={(event) => setMeta({ ...meta, isFeatured: event.target.checked })}
                />
                Feature this video
              </label>
            </div>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <button type="button" className="btn-primary btn-sm" disabled={!file || busy} onClick={save}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save video
            </button>
          </div>
        ) : null}
      </section>

      {videos.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {videos.map((video) => (
            <li key={video.id} className="card flex gap-4 p-4">
              <div className="relative h-28 w-40 shrink-0 overflow-hidden rounded-xl bg-charcoal">
                {video.thumbnailUrl ? (
                  <Image src={video.thumbnailUrl} alt="" fill sizes="160px" className="object-cover opacity-90" />
                ) : null}
                <span className="absolute inset-0 grid place-items-center text-white/85">
                  <Play size={26} />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg leading-snug">{video.title}</h2>
                  {video.isFeatured ? <Badge tone="gold">Featured</Badge> : null}
                  {video.isActive ? <Badge tone="success">Live</Badge> : <Badge tone="danger">Hidden</Badge>}
                </div>

                <p className="mt-1 text-xs text-muted">
                  {video.category.name}
                  {video.durationSeconds ? ` · ${formatSeconds(video.durationSeconds)}` : ""}
                  {video.fileSize ? ` · ${formatFileSize(video.fileSize)}` : ""} · {video.viewCount} views
                </p>

                {video.tags.length ? (
                  <p className="mt-1 truncate text-[0.68rem] text-muted">#{video.tags.slice(0, 4).join(" #")}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-outline btn-sm" onClick={() => setEditing(video)}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => toggleFlag(video, "isActive")}>
                    {video.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                    {video.isActive ? "Hide" : "Publish"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => toggleFlag(video, "isFeatured")}
                    aria-label={video.isFeatured ? "Unfeature video" : "Feature video"}
                  >
                    <Star size={14} className={video.isFeatured ? "fill-gold text-gold" : undefined} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-danger"
                    onClick={() => setDeleteTarget(video)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card p-6 text-sm text-muted">No videos published yet.</p>
      )}

      <VideoEditModal
        key={editing?.id ?? "none"}
        video={editing}
        categories={categories}
        busy={busy}
        error={error}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this video?"
        message={`“${deleteTarget?.title ?? ""}” will be removed from the website and deleted from media storage together with its thumbnail. This cannot be undone.`}
        confirmLabel="Yes, delete video"
        cancelLabel="Cancel"
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function VideoEditModal({
  video,
  categories,
  busy,
  error,
  onClose,
  onSaved,
}: {
  video: VideoRow | null;
  categories: Array<{ id: string; name: string }>;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: video?.title ?? "",
    description: video?.description ?? "",
    tags: video?.tags.join(", ") ?? "",
    categoryId: video?.category.id ?? categories[0]?.id ?? "",
    isFeatured: video?.isFeatured ?? false,
    isActive: video?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!video) return null;

  const save = async () => {
    setSaving(true);
    setLocalError(null);

    const result = await updateVideoAction({
      videoId: video.id,
      title: form.title,
      description: form.description,
      categoryId: form.categoryId,
      url: video.url,
      publicId: video.publicId ?? "",
      thumbnailUrl: video.thumbnailUrl ?? "",
      tags: form.tags,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    });

    setSaving(false);
    notifyResult(result);

    if (result.ok) onSaved();
    else setLocalError(result.error);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit video"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving || busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving || busy}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null} Save changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {localError ?? error ? <Alert tone="danger">{localError ?? error}</Alert> : null}

        <label className="block">
          <span className="label">Title</span>
          <input className="input mt-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>

        <label className="block">
          <span className="label">Description</span>
          <textarea
            className="textarea mt-2 min-h-[90px]"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="label">Collection</span>
            <select
              className="select mt-2"
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="label">Tags</span>
            <input className="input mt-2" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          </label>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-rosegold)]"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Visible on the website
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-rosegold)]"
              checked={form.isFeatured}
              onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })}
            />
            Featured
          </label>
        </div>

        <p className="text-xs text-muted">The video file itself cannot be replaced — upload a new video instead.</p>
      </div>
    </Modal>
  );
}
