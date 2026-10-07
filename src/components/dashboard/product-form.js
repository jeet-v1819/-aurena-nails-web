"use client";

/**
 * Create / edit product form shared by the admin and seller consoles.
 *
 * Both /api/admin/products and /api/seller/products accept the same payload and
 * run it through productService.normalizeProductData(), so one form serves both.
 * The only difference is `sellerId`: sellers never send it (the API derives it
 * from the session and strips any client-supplied value), admins pick one.
 *
 * Column realities this form respects:
 *   - `images`, `size`, `color` are String columns holding JSON, so the UI takes
 *     one-per-line text and converts to arrays before sending.
 *   - `specifications` is a JSON object in a String column, edited as key/value
 *     rows rather than raw JSON so a typo cannot produce a 500.
 *   - `discount` is a PERCENTAGE (0-100), not a fraction.
 */
import { useEffect, useMemo, useState } from "react";
import { FieldError } from "@/components/ui";
import { PRODUCT_STATUS, PRODUCT_STATUS_VALUES } from "@/lib/constants";
import { computeDiscountPrice, formatCurrency, parseJsonArray, parseJsonObject } from "@/utils/format";

const EMPTY = {
  name: "",
  slug: "",
  description: "",
  price: "",
  discount: "0",
  stock: "0",
  sku: "",
  categoryId: "",
  brandId: "",
  status: PRODUCT_STATUS.ACTIVE,
  imagesText: "",
  sizeText: "",
  colorText: "",
  specs: [],
};

function toForm(product) {
  if (!product) return { ...EMPTY, specs: [] };
  return {
    name: product.name || "",
    slug: product.slug || "",
    description: product.description || "",
    price: product.price === null || product.price === undefined ? "" : String(product.price),
    discount: String(product.discount ?? 0),
    stock: String(product.stock ?? 0),
    sku: product.sku || "",
    categoryId: product.categoryId || "",
    brandId: product.brandId || "",
    status: product.status || PRODUCT_STATUS.ACTIVE,
    imagesText: parseJsonArray(product.images, []).join("\n"),
    sizeText: parseJsonArray(product.size, []).join("\n"),
    colorText: parseJsonArray(product.color, []).join("\n"),
    specs: Object.entries(parseJsonObject(product.specifications, {})).map(([key, value]) => ({ key, value })),
  };
}

function linesTo(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function ProductFormModal({ open, product, categories = [], brands = [], sellers = null, onClose, onSubmit }) {
  const [form, setForm] = useState(() => toForm(product));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(product?.id);

  // Re-seed whenever a different product (or "new") is opened.
  useEffect(() => {
    if (open) {
      setForm(toForm(product));
      setErrors({});
      setFormError("");
    }
  }, [open, product]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const previewPrice = useMemo(() => {
    const price = Number(form.price);
    const discount = Number(form.discount);
    if (!Number.isFinite(price) || price < 0) return null;
    return computeDiscountPrice(price, Number.isFinite(discount) ? discount : 0);
  }, [form.discount, form.price]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFormError("");
  }

  function setSpec(index, key, value) {
    setForm((current) => ({
      ...current,
      specs: current.specs.map((row, i) => (i === index ? { key, value } : row)),
    }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "Product name is required.";
    if (form.price === "" || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
      next.price = "Enter a non-negative price.";
    }
    const discount = Number(form.discount);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      next.discount = "Discount must be between 0 and 100 (percent).";
    }
    const stock = Number.parseInt(form.stock, 10);
    if (!Number.isFinite(stock) || stock < 0) next.stock = "Stock must be a non-negative whole number.";
    if (sellers && !form.sellerId && !isEdit) next.sellerId = "Choose the seller who owns this product.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    const specifications = {};
    form.specs.forEach((row) => {
      const key = String(row.key || "").trim();
      if (key) specifications[key] = String(row.value ?? "").trim();
    });

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      discount: Number(form.discount),
      stock: Number.parseInt(form.stock, 10),
      status: PRODUCT_STATUS_VALUES.includes(form.status) ? form.status : PRODUCT_STATUS.ACTIVE,
      images: linesTo(form.imagesText),
      size: linesTo(form.sizeText),
      color: linesTo(form.colorText),
      specifications,
      categoryId: form.categoryId || null,
      brandId: form.brandId || null,
    };

    if (form.slug.trim()) payload.slug = form.slug.trim();
    if (form.sku.trim()) payload.sku = form.sku.trim();
    // Admins assign ownership; sellers must not be able to.
    if (sellers && form.sellerId) payload.sellerId = form.sellerId;
    if (isEdit) payload.id = product.id;

    setSaving(true);
    try {
      await onSubmit(payload, isEdit);
      onClose?.();
    } catch (err) {
      setFormError(err?.message || "Could not save this product.");
      if (err?.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-form-title"
    >
      <form onSubmit={handleSubmit} className="card my-8 w-full max-w-3xl p-6" noValidate>
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="product-form-title" className="text-lg font-semibold text-gray-900">
              {isEdit ? "Edit product" : "Add product"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Images, sizes and colours are entered one per line. Discount is a percentage.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost h-8 w-8 rounded-full p-0">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="pf-name" className="label">
              Name
            </label>
            <input id="pf-name" className="input" value={form.name} onChange={(e) => setField("name", e.target.value)} disabled={saving} />
            <FieldError>{errors.name}</FieldError>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="pf-description" className="label">
              Description
            </label>
            <textarea
              id="pf-description"
              rows={3}
              className="input resize-y"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label htmlFor="pf-price" className="label">
              Price
            </label>
            <input
              id="pf-price"
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              disabled={saving}
            />
            <FieldError>{errors.price}</FieldError>
          </div>

          <div>
            <label htmlFor="pf-discount" className="label">
              Discount (%)
            </label>
            <input
              id="pf-discount"
              type="number"
              step="1"
              min="0"
              max="100"
              className="input"
              value={form.discount}
              onChange={(e) => setField("discount", e.target.value)}
              disabled={saving}
            />
            <FieldError>{errors.discount}</FieldError>
            {previewPrice !== null && Number(form.discount) > 0 && (
              <p className="mt-1 text-xs text-green-700">Sells for {formatCurrency(previewPrice)}</p>
            )}
          </div>

          <div>
            <label htmlFor="pf-stock" className="label">
              Stock
            </label>
            <input
              id="pf-stock"
              type="number"
              step="1"
              min="0"
              className="input"
              value={form.stock}
              onChange={(e) => setField("stock", e.target.value)}
              disabled={saving}
            />
            <FieldError>{errors.stock}</FieldError>
          </div>

          <div>
            <label htmlFor="pf-status" className="label">
              Status
            </label>
            <select id="pf-status" className="input" value={form.status} onChange={(e) => setField("status", e.target.value)} disabled={saving}>
              {PRODUCT_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value === PRODUCT_STATUS.ACTIVE ? "Active (visible)" : value === PRODUCT_STATUS.INACTIVE ? "Inactive (hidden)" : "Out of stock"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pf-sku" className="label">
              SKU <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input id="pf-sku" className="input" value={form.sku} onChange={(e) => setField("sku", e.target.value)} disabled={saving} />
          </div>

          <div>
            <label htmlFor="pf-slug" className="label">
              Slug <span className="font-normal text-gray-400">(auto-generated if blank)</span>
            </label>
            <input id="pf-slug" className="input" value={form.slug} onChange={(e) => setField("slug", e.target.value)} disabled={saving} />
          </div>

          <div>
            <label htmlFor="pf-category" className="label">
              Category
            </label>
            <select id="pf-category" className="input" value={form.categoryId} onChange={(e) => setField("categoryId", e.target.value)} disabled={saving}>
              <option value="">— None —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pf-brand" className="label">
              Brand
            </label>
            <select id="pf-brand" className="input" value={form.brandId} onChange={(e) => setField("brandId", e.target.value)} disabled={saving}>
              <option value="">— None —</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {sellers && (
            <div className="sm:col-span-2">
              <label htmlFor="pf-seller" className="label">
                Owner (seller)
              </label>
              <select
                id="pf-seller"
                className="input"
                value={form.sellerId || (isEdit ? product.sellerId || "" : "")}
                onChange={(e) => setField("sellerId", e.target.value)}
                disabled={saving}
              >
                <option value="">— Choose a seller —</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name} ({seller.email})
                  </option>
                ))}
              </select>
              <FieldError>{errors.sellerId}</FieldError>
              {isEdit && <p className="mt-1 text-xs text-gray-500">Reassigning ownership moves the product between seller consoles.</p>}
            </div>
          )}

          <div>
            <label htmlFor="pf-images" className="label">
              Images <span className="font-normal text-gray-400">(one URL per line)</span>
            </label>
            <textarea
              id="pf-images"
              rows={3}
              className="input resize-y font-mono text-xs"
              value={form.imagesText}
              onChange={(e) => setField("imagesText", e.target.value)}
              placeholder={"/products/example.svg\nhttps://..."}
              disabled={saving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-size" className="label">
                Sizes <span className="font-normal text-gray-400">(one per line)</span>
              </label>
              <textarea
                id="pf-size"
                rows={3}
                className="input resize-y text-xs"
                value={form.sizeText}
                onChange={(e) => setField("sizeText", e.target.value)}
                placeholder={"S\nM\nL"}
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="pf-color" className="label">
                Colours <span className="font-normal text-gray-400">(one per line)</span>
              </label>
              <textarea
                id="pf-color"
                rows={3}
                className="input resize-y text-xs"
                value={form.colorText}
                onChange={(e) => setField("colorText", e.target.value)}
                placeholder={"Black\nWhite"}
                disabled={saving}
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <span className="label">Specifications</span>
            <div className="space-y-2">
              {form.specs.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={row.key}
                    placeholder="Key (e.g. Battery)"
                    onChange={(e) => setSpec(index, e.target.value, row.value)}
                    disabled={saving}
                    aria-label={`Specification ${index + 1} key`}
                  />
                  <input
                    className="input flex-[2]"
                    value={row.value}
                    placeholder="Value"
                    onChange={(e) => setSpec(index, row.key, e.target.value)}
                    disabled={saving}
                    aria-label={`Specification ${index + 1} value`}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, specs: c.specs.filter((_, i) => i !== index) }))}
                    className="btn-ghost shrink-0 px-2 text-danger"
                    aria-label={`Remove specification ${index + 1}`}
                    disabled={saving}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm((c) => ({ ...c, specs: [...c.specs, { key: "", value: "" }] }))}
                className="btn-outline px-3 py-1.5 text-sm"
                disabled={saving}
              >
                + Add specification
              </button>
            </div>
          </div>
        </div>

        {formError && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
            {formError}
          </p>
        )}

        <footer className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} className="btn-outline" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create product"}
          </button>
        </footer>
      </form>
    </div>
  );
}
