"use client";

/**
 * Seller → My products. Did not exist before.
 *
 * README requirements covered: add / edit / delete product, enable-disable a
 * product and manage stock, while only ever seeing YOUR OWN products.
 *
 * That last point is the security-critical one. The previous /api/seller/products
 * took `sellerId` from req.query, so any caller could manage another vendor's
 * catalogue. The endpoint now derives the seller from the session and re-checks
 * ownership on every single-product operation — so this page deliberately sends
 * no sellerId at all, and ProductFormModal is rendered without a `sellers` prop
 * (which hides the ownership picker).
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RoleGate from "@/components/dashboard/role-gate";
import ProductFormModal from "@/components/dashboard/product-form";
import { ErrorState, PageLoader, Pagination, ProductStatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useToast } from "@/components/providers";
import { ROLES } from "@/lib/constants";
import { formatCurrency, primaryImage } from "@/utils/format";

function SellerProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: toastError } = useToast();

  const page = Number(searchParams.get("page")) || 1;
  const urlSearch = searchParams.get("search") || "";
  const urlCategory = searchParams.get("category") || "";
  const urlStatus = searchParams.get("status") || "";

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const [search, setSearch] = useState(urlSearch);
  const [busyId, setBusyId] = useState(null);
  const [stockDrafts, setStockDrafts] = useState({});

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/seller/products", {
        query: { page, search: urlSearch, category: urlCategory, status: urlStatus, limit: 10 },
      });
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setStockDrafts({});
    } catch (err) {
      setError(err.message || "Could not load your products.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, urlCategory, urlSearch, urlStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get("/api/categories").then((data) => setCategories(Array.isArray(data) ? data : [])).catch(() => {});
    api.get("/api/brands").then((data) => setBrands(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  function pushFilters(overrides = {}) {
    const params = new URLSearchParams({
      search: overrides.search ?? urlSearch,
      category: overrides.category ?? urlCategory,
      status: overrides.status ?? urlStatus,
    });
    const qs = params.toString();
    router.push(qs ? `/seller/products?${qs}` : "/seller/products");
  }

  async function patchProduct(id, patch, okMessage) {
    setBusyId(id);
    try {
      await api.patch("/api/seller/products", { id, ...patch });
      success(okMessage);
      await load();
    } catch (err) {
      toastError(err.message || "Could not update that product.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function submitStock(product) {
    const raw = stockDrafts[product.id];
    if (raw === undefined || String(raw) === String(product.stock)) return;
    const stock = Number.parseInt(raw, 10);
    if (!Number.isFinite(stock) || stock < 0) {
      toastError("Stock must be a whole number of 0 or more.");
      return;
    }
    await patchProduct(product.id, { stock }, `Stock for ${product.name} set to ${stock}.`);
  }

  async function toggleStatus(product) {
    const next = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await patchProduct(
      product.id,
      { status: next },
      next === "ACTIVE" ? `${product.name} is live in the store.` : `${product.name} is hidden from shoppers.`
    );
  }

  async function submitForm(payload, isEdit) {
    if (isEdit) {
      await api.put("/api/seller/products", payload);
      success("Product updated.");
    } else {
      await api.post("/api/seller/products", payload);
      success("Product created — it is live in your storefront.");
    }
    await load();
  }

  async function openEdit(product) {
    setBusyId(product.id);
    try {
      const data = await api.get("/api/seller/products", { query: { id: product.id } });
      setEditing(data.product);
      setFormOpen(true);
    } catch (err) {
      toastError(err.message || "Could not load that product.");
    } finally {
      setBusyId(null);
    }
  }

  async function runDelete() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await api.del("/api/seller/products", { query: { id: confirmDelete.id } });
      success(`${confirmDelete.name} has been deleted.`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toastError(err.message || "Could not delete that product.");
    } finally {
      setBusyId(null);
    }
  }

  const baseQuery = new URLSearchParams({ search: urlSearch, category: urlCategory, status: urlStatus }).toString();

  return (
    <RoleGate
      role={ROLES.SELLER}
      title="Seller console"
      heading="My products"
      description={`${total} product${total === 1 ? "" : "s"} in your catalogue.`}
      actions={
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="btn-primary"
        >
          + Add product
        </button>
      }
    >
      {/* Filters */}
      <div className="card mb-4 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            pushFilters({ search: search.trim() });
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="lg:col-span-2">
            <label htmlFor="sp-search" className="label">
              Search
            </label>
            <input
              id="sp-search"
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, SKU or description"
            />
          </div>

          <div>
            <label htmlFor="sp-category" className="label">
              Category
            </label>
            <select id="sp-category" className="input" value={urlCategory} onChange={(event) => pushFilters({ category: event.target.value })}>
              <option value="">All</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sp-status" className="label">
              Status
            </label>
            <select id="sp-status" className="input" value={urlStatus} onChange={(event) => pushFilters({ status: event.target.value })}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
            </select>
          </div>

          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              Apply search
            </button>
          </div>
        </form>
      </div>

      {loading && products.length === 0 ? (
        <PageLoader label="Loading your products..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : products.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-gray-900">
            {urlSearch || urlCategory || urlStatus ? "No products match those filters." : "You have not listed anything yet."}
          </p>
          {!urlSearch && !urlCategory && !urlStatus && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="btn-primary mt-4"
            >
              Add your first product
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">Product</th>
                    <th className="th text-right">Price</th>
                    <th className="th">Stock</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className={busyId === product.id ? "opacity-60" : ""}>
                      <td className="td">
                        <span className="flex items-center gap-3">
                          <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={primaryImage(product.image)} alt="" className="h-full w-full object-cover" />
                          </span>
                          <span className="min-w-0">
                            <Link href={`/product/${product.id}`} className="line-clamp-1 block font-medium text-gray-900 hover:text-primary hover:underline">
                              {product.name}
                            </Link>
                            <span className="block text-xs text-gray-400">
                              {product.sku || product.slug}
                              {product.categoryName && <> · {product.categoryName}</>}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="td text-right">
                        <span className="block font-medium text-gray-900">{formatCurrency(product.unitPrice)}</span>
                        {product.onSale && <span className="block text-xs text-gray-400 line-through">{formatCurrency(product.price)}</span>}
                      </td>
                      <td className="td">
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="input w-20 py-1 text-xs"
                            value={stockDrafts[product.id] ?? product.stock}
                            onChange={(event) => setStockDrafts((c) => ({ ...c, [product.id]: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                submitStock(product);
                              }
                            }}
                            disabled={busyId === product.id}
                            aria-label={`Stock for ${product.name}`}
                          />
                          {stockDrafts[product.id] !== undefined && String(stockDrafts[product.id]) !== String(product.stock) && (
                            <button type="button" onClick={() => submitStock(product)} className="btn-outline px-2 py-1 text-xs" disabled={busyId === product.id}>
                              Save
                            </button>
                          )}
                        </span>
                        {product.stock <= 5 && <span className="mt-1 block text-xs text-amber-700">Low stock</span>}
                      </td>
                      <td className="td">
                        <button
                          type="button"
                          onClick={() => toggleStatus(product)}
                          disabled={busyId === product.id}
                          title={product.status === "ACTIVE" ? "Hide from the store" : "Publish to the store"}
                          className="cursor-pointer border-0 bg-transparent p-0"
                        >
                          <ProductStatusBadge value={product.status} />
                        </button>
                      </td>
                      <td className="td">
                        <span className="flex justify-end gap-1">
                          <button type="button" onClick={() => openEdit(product)} className="btn-outline px-2 py-1 text-xs" disabled={busyId === product.id}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ id: product.id, name: product.name })}
                            className="btn-ghost px-2 py-1 text-xs text-danger hover:text-danger"
                            disabled={busyId === product.id}
                          >
                            Delete
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} totalPages={totalPages} baseUrl={`/seller/products${baseQuery ? `?${baseQuery}` : ""}`} />
        </>
      )}

      {/* No `sellers` prop: a seller cannot reassign product ownership. */}
      <ProductFormModal
        open={formOpen}
        product={editing}
        categories={categories}
        brands={brands}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={submitForm}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="del-sp-title">
          <div className="card w-full max-w-md p-6">
            <h2 id="del-sp-title" className="text-lg font-semibold text-gray-900">
              Delete this product?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium">{confirmDelete.name}</span> will be removed from your catalogue. Orders that
              already contain it keep their snapshot, but shoppers can no longer buy it.
            </p>
            <p className="mt-2 text-xs text-gray-500">Tip: setting it to Inactive hides it without losing the listing.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn-outline" disabled={Boolean(busyId)}>
                Cancel
              </button>
              <button type="button" onClick={runDelete} className="btn-danger" disabled={Boolean(busyId)}>
                {busyId ? "Deleting..." : "Delete product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGate>
  );
}

export default function SellerProductsPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading your products..." />}>
      <SellerProductsContent />
    </Suspense>
  );
}
