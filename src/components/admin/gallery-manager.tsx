"use client";

/**
 * Gallery manager: drag & drop multi-upload with progress, per-design editing,
 * manual ordering and quick visibility toggles.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Star, Trash2, Upload } from "lucide-react";
import {
  createGalleryImagesAction,
  deleteGalleryImageAction,
  galleryFlagsAction,
  updateGalleryImageAction,
} from "@/server/actions/admin/content";
import { ImageUploader, type UploadedFile } from "@/components/ui/image-uploader";
import { ConfirmDialog, Modal } from "@/components/ui/interactive";
import { Alert, Badge } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { OCCASIONS, SERVICE_STYLES } from "@/lib/constants";

export type GalleryRow = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  publicId: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  format: string | null;
  tags: string[];
  style: string | null;
  occasion: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  category: { id: string; name: string };
};

type Defaults = {
  categoryId: string;
  tags: string;
  style: string;
  occasion: string;
  isActive: boolean;
  isFeatured: boolean;
};

export function GalleryManager({
  images,
  categories,
}: {
  images: GalleryRow[];
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  const [defaults, setDefaults] = useState<Defaults>({
    categoryId: categories[0]?.id ?? "",
    tags: "",
    style: "",
    occasion: "",
    isActive: true,
    isFeatured: false,
  });
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<GalleryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GalleryRow | null>(null);
  const [reordering, setReordering] = useState(false);

  const saveUploads = async () => {
    if (!uploaded.length) return;
    setBusy(true);
    setError(null);

    const result = await createGalleryImagesAction({
      items: uploaded.map((file) => ({
        title: file.originalName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 140) || "New design",
        url: file.url,
        publicId: file.publicId,
        width: file.width,
        height: file.height,
        fileSize: file.bytes,
        format: file.format,
        alt: "",
        description: "",
      })),
      defaults: {
        categoryId: defaults.categoryId,
        tags: defaults.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        style: defaults.style || undefined,
        occasion: defaults.occasion || undefined,
        isActive: defaults.isActive,
        isFeatured: defaults.isFeatured,
      },
    });

    setBusy(false);
    notifyResult(result);

    if (result.ok) {
      setUploaded([]);
      setUploadOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const saveEdit = async (values: {
    title: string;
    description: string;
    tags: string;
    style: string;
    occasion: string;
    categoryId: string;
    alt: string;
    isActive: boolean;
    isFeatured: boolean;
    sortOrder: number;
  }) => {
    if (!editing) return;
    setBusy(true);
    setError(null);

    const result = await updateGalleryImageAction({
      imageId: editing.id,
      ...values,
      tags: values.tags,
    });

    setBusy(false);
    notifyResult(result);

    if (result.ok) {
      setEditing(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const toggleFlag = async (image: GalleryRow, flag: "isActive" | "isFeatured") => {
    setBusy(true);
    const result = await galleryFlagsAction({ imageId: image.id, [flag]: !image[flag] });
    setBusy(false);
    notifyResult(result);
    if (result.ok) router.refresh();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const current = images[index];
    const neighbour = images[index + direction];
    if (!current || !neighbour) return;

    setReordering(true);
    const first = await updateGalleryImageAction({ imageId: current.id, sortOrder: neighbour.sortOrder });
    const second = await updateGalleryImageAction({ imageId: neighbour.id, sortOrder: current.sortOrder });
    setReordering(false);

    notifyResult(first.ok ? second : first);
    router.refresh();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteGalleryImageAction({ imageId: deleteTarget.id });
    setBusy(false);
    notifyResult(result);
    setDeleteTarget(null);
    if (result.ok) router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- bulk upload */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Add designs</h2>
            <p className="mt-1 text-sm text-muted">
              Drop several photos at once — each one becomes a design. JPG, PNG or WEBP up to 8 MB.
            </p>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={() => setUploadOpen((value) => !value)}>
            <Upload size={15} /> {uploadOpen ? "Close" : "Upload designs"}
          </button>
        </div>

        {uploadOpen ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-dashed border-nude-dark p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="min-w-0">
                <span className="label">Collection</span>
                <select
                  className="select mt-2"
                  value={defaults.categoryId}
                  onChange={(event) => setDefaults({ ...defaults, categoryId: event.target.value })}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className="label">Tags (comma separated)</span>
                <input
                  className="input mt-2"
                  value={defaults.tags}
                  onChange={(event) => setDefaults({ ...defaults, tags: event.target.value })}
                  placeholder="french, minimal, office"
                />
              </label>

              <label className="min-w-0">
                <span className="label">Style</span>
                <select
                  className="select mt-2"
                  value={defaults.style}
                  onChange={(event) => setDefaults({ ...defaults, style: event.target.value })}
                >
                  <option value="">Not specified</option>
                  {SERVICE_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className="label">Occasion</span>
                <select
                  className="select mt-2"
                  value={defaults.occasion}
                  onChange={(event) => setDefaults({ ...defaults, occasion: event.target.value })}
                >
                  <option value="">Not specified</option>
                  {OCCASIONS.map((occasion) => (
                    <option key={occasion} value={occasion}>
                      {occasion}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-rosegold)]"
                  checked={defaults.isActive}
                  onChange={(event) => setDefaults({ ...defaults, isActive: event.target.checked })}
                />
                Publish immediately
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-rosegold)]"
                  checked={defaults.isFeatured}
                  onChange={(event) => setDefaults({ ...defaults, isFeatured: event.target.checked })}
                />
                Feature these designs
              </label>
            </div>

            <ImageUploader
              kind="image"
              folder="gallery"
              multiple
              label="Drag & drop photos here, or browse"
              onUploaded={(files) => setUploaded((current) => [...current, ...files])}
            />

            {uploaded.length ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted">
                  {uploaded.length} file{uploaded.length === 1 ? "" : "s"} ready to save.
                </p>
                <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={saveUploads}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Create{" "}
                  {uploaded.length} design{uploaded.length === 1 ? "" : "s"}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setUploaded([])} disabled={busy}>
                  Clear
                </button>
              </div>
            ) : null}

            {error ? <Alert tone="danger">{error}</Alert> : null}
          </div>
        ) : null}
      </section>

      {/* ----------------------------------------------------------- grid */}
      {images.length ? (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="card overflow-hidden">
              <div className="relative aspect-square bg-nude">
                <Image
                  src={image.url}
                  alt={image.alt ?? image.title}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />

                <div className="absolute left-2 top-2 flex flex-col gap-1">
                  {image.isFeatured ? <Badge tone="gold">Featured</Badge> : null}
                  {!image.isActive ? <Badge tone="danger">Hidden</Badge> : null}
                </div>

                <span className="absolute right-2 top-2 rounded-full bg-charcoal/70 px-2 py-1 text-[0.65rem] text-white">
                  #{index + 1}
                </span>
              </div>

              <div className="p-3">
                <p className="truncate text-sm font-medium">{image.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{image.category.name}</p>
                {image.tags.length ? (
                  <p className="mt-1 truncate text-[0.68rem] text-muted">#{image.tags.slice(0, 3).join(" #")}</p>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted transition hover:bg-cream-deep hover:text-charcoal disabled:opacity-40"
                    aria-label="Move earlier"
                    disabled={index === 0 || reordering}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted transition hover:bg-cream-deep hover:text-charcoal disabled:opacity-40"
                    aria-label="Move later"
                    disabled={index === images.length - 1 || reordering}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted transition hover:bg-cream-deep hover:text-gold"
                    aria-label={image.isFeatured ? "Remove from featured" : "Feature design"}
                    onClick={() => toggleFlag(image, "isFeatured")}
                  >
                    <Star size={14} className={image.isFeatured ? "fill-gold text-gold" : undefined} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted transition hover:bg-cream-deep hover:text-charcoal"
                    aria-label="Edit design"
                    onClick={() => {
                      setError(null);
                      setEditing(image);
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted transition hover:bg-cream-deep hover:text-danger"
                    aria-label="Delete design"
                    onClick={() => setDeleteTarget(image)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  className="mt-2 w-full rounded-lg bg-cream-deep py-1.5 text-[0.7rem] text-muted transition hover:text-charcoal"
                  onClick={() => toggleFlag(image, "isActive")}
                >
                  {image.isActive ? "Hide from website" : "Publish design"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card p-6 text-sm text-muted">
          No designs yet. Upload your first set above — you can edit titles, tags and collections afterwards.
        </p>
      )}

      {/* ------------------------------------------------------------ edit */}
      <GalleryEditModal
        image={editing}
        categories={categories}
        busy={busy}
        error={error}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this design?"
        message={`“${deleteTarget?.title ?? ""}” will be removed from the gallery and deleted from media storage. Clients who saved it to a wishlist will lose it.`}
        confirmLabel="Yes, delete design"
        cancelLabel="Cancel"
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function GalleryEditModal({
  image,
  categories,
  busy,
  error,
  onClose,
  onSave,
}: {
  image: GalleryRow | null;
  categories: Array<{ id: string; name: string }>;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: {
    title: string;
    description: string;
    tags: string;
    style: string;
    occasion: string;
    categoryId: string;
    alt: string;
    isActive: boolean;
    isFeatured: boolean;
    sortOrder: number;
  }) => void;
}) {
  const [form, setForm] = useState(() => ({
    title: image?.title ?? "",
    description: image?.description ?? "",
    tags: image?.tags.join(", ") ?? "",
    style: image?.style ?? "",
    occasion: image?.occasion ?? "",
    categoryId: image?.category.id ?? categories[0]?.id ?? "",
    alt: image?.alt ?? "",
    isActive: image?.isActive ?? true,
    isFeatured: image?.isFeatured ?? false,
    sortOrder: image?.sortOrder ?? 0,
  }));

  if (!image) return null;

  return (
    <Modal
      open={Boolean(image)}
      onClose={onClose}
      title="Edit design"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => onSave(form)} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Save changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="flex gap-4">
          <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-nude">
            <Image src={image.url} alt="" fill sizes="96px" className="object-cover" />
          </span>
          <p className="text-xs text-muted">
            {image.width && image.height ? `${image.width} × ${image.height}px` : "Dimensions unknown"}
            {image.fileSize ? ` · ${(image.fileSize / 1024).toFixed(0)} KB` : ""}
            <br />
            {image.format ? image.format.toUpperCase() : ""}
          </p>
        </div>

        <label className="block">
          <span className="label">Title</span>
          <input
            className="input mt-2"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
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
            <input
              className="input mt-2"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              placeholder="french, chrome, bridal"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="label">Style</span>
            <select
              className="select mt-2"
              value={form.style}
              onChange={(event) => setForm({ ...form, style: event.target.value })}
            >
              <option value="">Not specified</option>
              {SERVICE_STYLES.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="label">Occasion</span>
            <select
              className="select mt-2"
              value={form.occasion}
              onChange={(event) => setForm({ ...form, occasion: event.target.value })}
            >
              <option value="">Not specified</option>
              {OCCASIONS.map((occasion) => (
                <option key={occasion} value={occasion}>
                  {occasion}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="label">Alt text (for screen readers)</span>
          <input
            className="input mt-2"
            value={form.alt}
            onChange={(event) => setForm({ ...form, alt: event.target.value })}
            placeholder="Soft French tips with a gold accent nail"
          />
        </label>

        <label className="block">
          <span className="label">Sort order</span>
          <input
            type="number"
            min={0}
            className="input mt-2"
            value={form.sortOrder}
            onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
          />
        </label>

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
      </div>
    </Modal>
  );
}
