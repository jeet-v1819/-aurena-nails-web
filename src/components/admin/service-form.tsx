"use client";

/**
 * Create / edit a service. Every field the studio asked for lives here:
 * descriptions, category, duration, informational pricing, nail type, style,
 * occasion, difficulty, prep & after-care, and the visibility flags.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Sparkles } from "lucide-react";
import { createServiceAction, updateServiceAction } from "@/server/actions/admin/catalog";
import { Alert } from "@/components/ui/primitives";
import { Field, FieldGrid, Toggle } from "@/components/admin/form-fields";
import { notifyResult } from "@/components/ui/toaster";
import { DIFFICULTIES, NAIL_TYPES, OCCASIONS, SERVICE_STYLES } from "@/lib/constants";
import { slugify } from "@/lib/format";

export type ServiceFormValues = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  durationMinutes: number;
  startingPrice: string;
  regularPrice: string;
  promoPrice: string;
  currency: string;
  nailType: string;
  style: string;
  occasion: string;
  difficulty: string;
  preparationInstructions: string;
  afterCareInstructions: string;
  isActive: boolean;
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
};

export const EMPTY_SERVICE: ServiceFormValues = {
  name: "",
  slug: "",
  shortDescription: "",
  description: "",
  categoryId: "",
  durationMinutes: 60,
  startingPrice: "",
  regularPrice: "",
  promoPrice: "",
  currency: "INR",
  nailType: "",
  style: "",
  occasion: "",
  difficulty: "",
  preparationInstructions: "",
  afterCareInstructions: "",
  isActive: true,
  isFeatured: false,
  isAvailable: true,
  sortOrder: 0,
};

export function ServiceForm({
  categories,
  serviceId,
  initial,
}: {
  categories: Array<{ id: string; name: string }>;
  serviceId?: string;
  initial?: ServiceFormValues;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ServiceFormValues>(initial ?? EMPTY_SERVICE);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    setErrors({});

    const payload = {
      ...form,
      slug: form.slug || slugify(form.name),
      categoryId: form.categoryId || categories[0]?.id || "",
    };

    const result = serviceId
      ? await updateServiceAction({ serviceId, ...payload })
      : await createServiceAction(payload);

    setBusy(false);

    if (!result.ok) {
      notifyResult(result);
      setError(result.error);
      setErrors(result.fieldErrors ?? {});
      return;
    }

    notifyResult(result);

    if (!serviceId && "data" in result && result.data && typeof result.data === "object" && "id" in result.data) {
      router.push(`/admin/services/${(result.data as { id: string }).id}`);
      return;
    }

    router.refresh();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <section className="card p-6">
        <h2 className="font-display text-xl">Basics</h2>
        <div className="mt-5 space-y-5">
          <FieldGrid>
            <Field label="Service name" htmlFor="name" required error={errors.name?.[0]}>
              <input
                id="name"
                className="input"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="Gel Extensions with Chrome Finish"
              />
            </Field>
            <Field
              label="URL slug"
              htmlFor="slug"
              hint="Leave blank to generate from the name."
              error={errors.slug?.[0]}
            >
              <input
                id="slug"
                className="input"
                value={form.slug}
                onChange={(event) => set("slug", event.target.value)}
                placeholder={slugify(form.name) || "gel-extensions"}
              />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field label="Category" htmlFor="categoryId" required error={errors.categoryId?.[0]}>
              <select
                id="categoryId"
                className="select"
                value={form.categoryId}
                onChange={(event) => set("categoryId", event.target.value)}
              >
                <option value="">Choose a category…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Duration (minutes)"
              htmlFor="durationMinutes"
              required
              hint="Drives the appointment slots and availability rules."
              error={errors.durationMinutes?.[0]}
            >
              <input
                id="durationMinutes"
                type="number"
                min={15}
                step={5}
                className="input"
                value={form.durationMinutes}
                onChange={(event) => set("durationMinutes", Number(event.target.value))}
              />
            </Field>
          </FieldGrid>

          <Field
            label="Short description"
            htmlFor="shortDescription"
            required
            hint="One line shown on cards and in search results."
            error={errors.shortDescription?.[0]}
          >
            <input
              id="shortDescription"
              className="input"
              maxLength={300}
              value={form.shortDescription}
              onChange={(event) => set("shortDescription", event.target.value)}
            />
          </Field>

          <Field
            label="Full description"
            htmlFor="description"
            required
            hint="Blank lines start a new paragraph on the service page."
            error={errors.description?.[0]}
          >
            <textarea
              id="description"
              className="textarea min-h-[160px]"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-xl">Pricing (informational only)</h2>
        <p className="mt-1 text-sm text-muted">
          Aurena Nails does not sell online — prices are shown as guidance and confirmed in the studio. Leave a field
          blank to hide it.
        </p>

        <div className="mt-5">
          <FieldGrid columns={3}>
            <Field label="Starting price" htmlFor="startingPrice" hint="Shown as “₹X onwards”.">
              <input
                id="startingPrice"
                inputMode="decimal"
                className="input"
                value={form.startingPrice}
                onChange={(event) => set("startingPrice", event.target.value)}
                placeholder="1299"
              />
            </Field>
            <Field label="Regular price" htmlFor="regularPrice">
              <input
                id="regularPrice"
                inputMode="decimal"
                className="input"
                value={form.regularPrice}
                onChange={(event) => set("regularPrice", event.target.value)}
              />
            </Field>
            <Field label="Promo price" htmlFor="promoPrice">
              <input
                id="promoPrice"
                inputMode="decimal"
                className="input"
                value={form.promoPrice}
                onChange={(event) => set("promoPrice", event.target.value)}
              />
            </Field>
          </FieldGrid>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-xl">Design details</h2>
        <div className="mt-5 space-y-5">
          <FieldGrid columns={3}>
            <Field label="Nail type" htmlFor="nailType">
              <select id="nailType" className="select" value={form.nailType} onChange={(event) => set("nailType", event.target.value)}>
                <option value="">Not specified</option>
                {NAIL_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Style" htmlFor="style">
              <select id="style" className="select" value={form.style} onChange={(event) => set("style", event.target.value)}>
                <option value="">Not specified</option>
                {SERVICE_STYLES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Occasion" htmlFor="occasion">
              <select
                id="occasion"
                className="select"
                value={form.occasion}
                onChange={(event) => set("occasion", event.target.value)}
              >
                <option value="">Not specified</option>
                {OCCASIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field label="Artistry level" htmlFor="difficulty">
              <select
                id="difficulty"
                className="select"
                value={form.difficulty}
                onChange={(event) => set("difficulty", event.target.value)}
              >
                <option value="">Not specified</option>
                {DIFFICULTIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sort order" htmlFor="sortOrder" hint="Lower numbers appear first.">
              <input
                id="sortOrder"
                type="number"
                min={0}
                className="input"
                value={form.sortOrder}
                onChange={(event) => set("sortOrder", Number(event.target.value))}
              />
            </Field>
          </FieldGrid>

          <FieldGrid>
            <Field
              label="Before your appointment"
              htmlFor="preparationInstructions"
              hint="One instruction per line. Shown as a checklist."
            >
              <textarea
                id="preparationInstructions"
                className="textarea min-h-[130px]"
                value={form.preparationInstructions}
                onChange={(event) => set("preparationInstructions", event.target.value)}
                placeholder={"Arrive with clean, product-free nails\nBring inspiration photos\nEat before long appointments"}
              />
            </Field>
            <Field label="After-care" htmlFor="afterCareInstructions" hint="One tip per line.">
              <textarea
                id="afterCareInstructions"
                className="textarea min-h-[130px]"
                value={form.afterCareInstructions}
                onChange={(event) => set("afterCareInstructions", event.target.value)}
                placeholder={"Apply cuticle oil daily\nAvoid hot water for 24 hours\nBook your infill in 3 weeks"}
              />
            </Field>
          </FieldGrid>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-xl">Visibility</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Toggle
            label="Active"
            description="Show this service everywhere on the website."
            checked={form.isActive}
            onChange={(value) => set("isActive", value)}
          />
          <Toggle
            label="Bookable"
            description="Allow new appointments to be requested."
            checked={form.isAvailable}
            onChange={(value) => set("isAvailable", value)}
          />
          <Toggle
            label="Featured"
            description="Highlight on the homepage and top of the list."
            checked={form.isFeatured}
            onChange={(value) => set("isFeatured", value)}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {busy ? "Saving…" : serviceId ? "Save changes" : "Create service"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => router.push("/admin/services")} disabled={busy}>
          Cancel
        </button>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Sparkles size={13} className="text-rosegold" />
          {serviceId ? "Add images and videos below the form." : "Images and videos can be added after saving."}
        </p>
      </div>
    </form>
  );
}
