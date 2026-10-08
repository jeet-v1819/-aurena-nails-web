"use client";

/**
 * Category manager: one component for creating, editing and deleting the
 * SERVICE / GALLERY / VIDEO categories used across the site.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/server/actions/admin/catalog";
import { ConfirmDialog, Modal } from "@/components/ui/interactive";
import { Alert, Badge } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { CATEGORY_TYPES } from "@/lib/constants";
import { slugify } from "@/lib/format";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { services: number; galleryImages: number; videos: number };
};

const EMPTY = {
  name: "",
  slug: "",
  type: "SERVICE",
  description: "",
  imageUrl: "",
  imagePublicId: "",
  isActive: true,
  sortOrder: 0,
};

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setForm({ ...EMPTY });
    setEditingId(null);
    setError(null);
    setOpen(true);
  };

  const openEdit = (category: CategoryRow) => {
    setForm({
      name: category.name,
      slug: category.slug,
      type: category.type,
      description: category.description ?? "",
      imageUrl: category.imageUrl ?? "",
      imagePublicId: category.imagePublicId ?? "",
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    });
    setEditingId(category.id);
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);

    const payload = { ...form, slug: form.slug || slugify(form.name) };
    const result = editingId
      ? await updateCategoryAction({ categoryId: editingId, ...payload })
      : await createCategoryAction(payload);

    setBusy(false);

    if (!result.ok) {
      notifyResult(result);
      setError(result.error);
      return;
    }

    notifyResult(result);
    setOpen(false);
    router.refresh();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteCategoryAction({ categoryId: deleteTarget.id });
    setBusy(false);
    notifyResult(result);
    setDeleteTarget(null);
    if (result.ok) router.refresh();
  };

  const usage = (category: CategoryRow) =>
    category.type === "SERVICE"
      ? category._count.services
      : category.type === "GALLERY"
        ? category._count.galleryImages
        : category._count.videos;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Categories group your services, gallery designs and videos. Keep names short — they appear in filters and
          breadcrumbs.
        </p>
        <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
          <FolderPlus size={15} /> New category
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <article key={category.id} className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg">{category.name}</h2>
                <p className="mt-1 truncate text-xs text-muted">/{category.slug}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={category.type === "SERVICE" ? "rose" : category.type === "GALLERY" ? "gold" : "muted"}>
                  {CATEGORY_TYPES[category.type as keyof typeof CATEGORY_TYPES] ?? category.type}
                </Badge>
                {category.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Hidden</Badge>}
              </div>
            </div>

            {category.description ? (
              <p className="mt-3 line-clamp-2 text-sm text-muted">{category.description}</p>
            ) : null}

            <p className="mt-4 text-xs text-muted">
              {usage(category)} item{usage(category) === 1 ? "" : "s"} · sort order {category.sortOrder}
            </p>

            <div className="mt-auto flex items-center gap-2 pt-5">
              <button type="button" className="btn-outline btn-sm" onClick={() => openEdit(category)}>
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm text-danger"
                onClick={() => setDeleteTarget(category)}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </article>
        ))}

        <button
          type="button"
          onClick={openCreate}
          className="flex min-h-[11rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-nude-dark bg-white/60 p-5 text-sm text-muted transition hover:border-rosegold-soft hover:text-rosegold-dark"
        >
          <Plus size={20} />
          Add a category
        </button>
      </div>

      {/* ------------------------------------------------------------ modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit category" : "New category"}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} {editingId ? "Save changes" : "Create category"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="label">Name</span>
              <input
                className="input mt-2"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Gel Extensions"
              />
            </label>
            <label className="min-w-0">
              <span className="label">URL slug</span>
              <input
                className="input mt-2"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder={slugify(form.name) || "gel-extensions"}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="label">Type</span>
              <select
                className="select mt-2"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
              >
                <option value="SERVICE">Service category</option>
                <option value="GALLERY">Gallery collection</option>
                <option value="VIDEO">Video collection</option>
              </select>
            </label>
            <label className="min-w-0">
              <span className="label">Sort order</span>
              <input
                type="number"
                min={0}
                className="input mt-2"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
              />
            </label>
          </div>

          <label className="block">
            <span className="label">Description</span>
            <textarea
              className="textarea mt-2 min-h-[90px]"
              maxLength={600}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="A short line used on the category page and in filters."
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-rosegold)]"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Visible on the website
          </label>

          <p className="text-xs text-muted">
            Deleting a category that still has items attached is blocked — move or remove those first.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this category?"
        message={`Are you sure you want to delete “${deleteTarget?.name ?? ""}”? This cannot be undone.`}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
