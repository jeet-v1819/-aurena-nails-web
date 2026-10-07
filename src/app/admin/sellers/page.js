"use client";

/**
 * Admin → Seller management. Did not exist before.
 *
 * README requirements covered: seller management, enable/disable sellers
 * (disabling also deactivates their products, server-side) and delete sellers
 * (which cascades, so it needs an explicit force confirmation).
 *
 * Also exposes the admin onboarding path added to POST /api/admin/sellers: a new
 * seller can be created without a password and a one-time temporary password is
 * returned exactly once so it can be handed over out of band.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RoleGate from "@/components/dashboard/role-gate";
import { ErrorState, FieldError, PageLoader, Pagination } from "@/components/ui";
import { api } from "@/lib/api";
import { useToast } from "@/components/providers";
import { ROLES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/utils/format";

const EMPTY_NEW = { name: "", email: "", phone: "", password: "" };

function SellersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: toastError } = useToast();

  const page = Number(searchParams.get("page")) || 1;
  const urlStatus = searchParams.get("status") || "";
  const urlSearch = searchParams.get("search") || "";

  const [sellers, setSellers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState(urlSearch);
  const [busyId, setBusyId] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_NEW);
  const [createErrors, setCreateErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState(null); // { email, password }

  const [detail, setDetail] = useState(null); // { seller, stats }
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/admin/sellers", {
        query: { page, status: urlStatus, search: urlSearch, limit: 10 },
      });
      setSellers(data.sellers || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || "Could not load sellers.");
      setSellers([]);
    } finally {
      setLoading(false);
    }
  }, [page, urlSearch, urlStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  function pushFilters(nextSearch, nextStatus) {
    const params = new URLSearchParams({ search: nextSearch, status: nextStatus });
    const qs = params.toString();
    router.push(qs ? `/admin/sellers?${qs}` : "/admin/sellers");
  }

  async function toggleStatus(seller) {
    setBusyId(seller.id);
    try {
      const next = !seller.status;
      const data = await api.put("/api/admin/sellers", { id: seller.id, status: next });
      success(data.message || (next ? "Seller enabled." : "Seller disabled and their products deactivated."));
      await load();
    } catch (err) {
      toastError(err.message || "Could not update that seller.");
    } finally {
      setBusyId(null);
    }
  }

  async function openDetail(seller) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await api.get("/api/admin/sellers", { query: { id: seller.id } });
      setDetail(data);
    } catch (err) {
      toastError(err.message || "Could not load that seller's statistics.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitCreate(event) {
    event.preventDefault();
    setCreateErrors({});

    const errors = {};
    if (createForm.name.trim().length < 2) errors.name = "Seller name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim())) errors.email = "Enter a valid email address.";
    if (createForm.password && createForm.password.length < 8) errors.password = "A supplied password must be at least 8 characters.";
    if (Object.keys(errors).length) {
      setCreateErrors(errors);
      return;
    }

    setCreating(true);
    try {
      const data = await api.post("/api/admin/sellers", {
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim() || undefined,
        password: createForm.password || undefined,
      });
      setTempPassword({ email: data.seller.email, password: data.temporaryPassword });
      setCreateForm(EMPTY_NEW);
      setCreateOpen(false);
      success(`${data.seller.email} can now sign in as a seller.`);
      await load();
    } catch (err) {
      setCreateErrors(err.details || {});
      toastError(err.message || "Could not create that seller.");
    } finally {
      setCreating(false);
    }
  }

  async function runDelete(force) {
    if (!confirmDelete) return;
    const seller = confirmDelete.seller;
    setBusyId(seller.id);
    try {
      await api.del("/api/admin/sellers", { query: { id: seller.id, force: force ? "1" : undefined } });
      success(`${seller.email} has been deleted.`);
      setConfirmDelete(null);
      setDetail(null);
      await load();
    } catch (err) {
      if (err.status === 409 && !force) {
        setConfirmDelete({ seller, force: true, counts: err.details || {}, message: err.message });
      } else {
        toastError(err.message || "Could not delete that seller.");
      }
    } finally {
      setBusyId(null);
    }
  }

  const baseQuery = new URLSearchParams({ search: urlSearch, status: urlStatus }).toString();

  return (
    <RoleGate
      role={ROLES.ADMIN}
      title="Admin console"
      heading="Sellers"
      description={`${total} seller account${total === 1 ? "" : "s"} match the current filters.`}
      actions={
        <>
          <Link href="/admin/users" className="btn-outline">
            All users
          </Link>
          <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary">
            + Add seller
          </button>
        </>
      }
    >
      {/* Filters */}
      <div className="card mb-4 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            pushFilters(search.trim(), urlStatus);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-56 flex-1">
            <label htmlFor="s-search" className="label">
              Search
            </label>
            <input
              id="s-search"
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Seller name, email or phone"
            />
          </div>

          <div>
            <span className="label">Status</span>
            <div className="flex gap-1">
              {[
                { value: "", label: "All" },
                { value: "true", label: "Enabled" },
                { value: "false", label: "Disabled" },
              ].map((option) => (
                <Link
                  key={option.value || "all"}
                  href={`/admin/sellers?${new URLSearchParams({ search: urlSearch, status: option.value }).toString()}`}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    urlStatus === option.value ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>
      </div>

      {tempPassword?.password && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4" role="status">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-900">Share this temporary password once</p>
              <p className="mt-0.5 text-xs text-green-800">
                {tempPassword.email} — it is stored hashed and is never shown again.
              </p>
              <code className="mt-2 block select-all rounded bg-white px-3 py-2 font-mono text-sm text-gray-900">
                {tempPassword.password}
              </code>
            </div>
            <button type="button" onClick={() => setTempPassword(null)} className="btn-ghost shrink-0 px-2 text-green-800">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {loading && sellers.length === 0 ? (
        <PageLoader label="Loading sellers..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : sellers.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">
          No sellers match those filters. Use <span className="font-medium">+ Add seller</span> to onboard one.
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">Seller</th>
                    <th className="th">Status</th>
                    <th className="th">Joined</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((seller) => (
                    <tr key={seller.id} className={busyId === seller.id ? "opacity-60" : ""}>
                      <td className="td">
                        <span className="block font-medium text-gray-900">{seller.name || "Unnamed"}</span>
                        <span className="block text-xs text-gray-500">{seller.email}</span>
                        {seller.phone && <span className="block text-xs text-gray-400">{seller.phone}</span>}
                      </td>
                      <td className="td">
                        <button
                          type="button"
                          onClick={() => toggleStatus(seller)}
                          disabled={busyId === seller.id}
                          title={seller.status ? "Disable — also deactivates their products" : "Enable — reactivates their products"}
                          className={`badge cursor-pointer border-0 ${
                            seller.status ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-danger hover:bg-red-200"
                          }`}
                        >
                          {seller.status ? "Enabled" : "Disabled"}
                        </button>
                      </td>
                      <td className="td text-xs text-gray-500">{formatDate(seller.createdAt, { dateStyle: "medium" })}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => openDetail(seller)} className="btn-outline px-2 py-1 text-xs">
                            Stats
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ seller, force: false })}
                            disabled={busyId === seller.id}
                            className="btn-ghost px-2 py-1 text-xs text-danger hover:text-danger"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} totalPages={totalPages} baseUrl={`/admin/sellers${baseQuery ? `?${baseQuery}` : ""}`} />
        </>
      )}

      {/* Create seller */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-seller-title">
          <form onSubmit={submitCreate} className="card w-full max-w-md p-6" noValidate>
            <h2 id="add-seller-title" className="text-lg font-semibold text-gray-900">
              Add a seller
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Leave the password blank to generate a one-time temporary password.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="ns-name" className="label">
                  Business / full name
                </label>
                <input
                  id="ns-name"
                  className="input"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((c) => ({ ...c, name: event.target.value }))}
                  disabled={creating}
                />
                <FieldError>{createErrors.name}</FieldError>
              </div>

              <div>
                <label htmlFor="ns-email" className="label">
                  Email
                </label>
                <input
                  id="ns-email"
                  type="email"
                  className="input"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((c) => ({ ...c, email: event.target.value }))}
                  disabled={creating}
                />
                <FieldError>{createErrors.email}</FieldError>
              </div>

              <div>
                <label htmlFor="ns-phone" className="label">
                  Phone <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="ns-phone"
                  className="input"
                  value={createForm.phone}
                  onChange={(event) => setCreateForm((c) => ({ ...c, phone: event.target.value }))}
                  disabled={creating}
                />
              </div>

              <div>
                <label htmlFor="ns-password" className="label">
                  Password <span className="font-normal text-gray-400">(optional — leave blank to generate)</span>
                </label>
                <input
                  id="ns-password"
                  type="text"
                  className="input font-mono text-sm"
                  value={createForm.password}
                  onChange={(event) => setCreateForm((c) => ({ ...c, password: event.target.value }))}
                  disabled={creating}
                />
                <FieldError>{createErrors.password}</FieldError>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="btn-outline" disabled={creating}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? "Creating..." : "Create seller"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Seller statistics */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="seller-stats-title">
          <div className="card my-8 w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 id="seller-stats-title" className="text-lg font-semibold text-gray-900">
                {detail?.seller?.name || "Seller statistics"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setDetailLoading(false);
                }}
                aria-label="Close"
                className="btn-ghost h-8 w-8 rounded-full p-0"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {detailLoading ? (
              <PageLoader label="Loading statistics..." />
            ) : (
              detail && (
                <>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {detail.seller.email} · joined {formatDate(detail.seller.createdAt, { dateStyle: "medium" })}
                  </p>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ["Products", detail.stats?.totalProducts],
                      ["Active", detail.stats?.activeProducts],
                      ["Out of stock", detail.stats?.outOfStock],
                      ["Orders", detail.stats?.totalOrders],
                      ["Pending", detail.stats?.pendingOrders],
                      ["Units sold", detail.stats?.unitsSold],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md bg-gray-50 p-3">
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
                        <dd className="mt-0.5 text-lg font-bold text-gray-900">{value ?? 0}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-green-200 bg-green-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-green-700">Revenue</p>
                      <p className="mt-0.5 text-xl font-bold text-green-900">{formatCurrency(detail.stats?.totalSales)}</p>
                      <p className="text-xs text-green-800">Excludes cancelled and refunded orders</p>
                    </div>
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Subtotal sold</p>
                      <p className="mt-0.5 text-xl font-bold text-gray-900">{formatCurrency(detail.stats?.grossSubtotal)}</p>
                      <p className="text-xs text-gray-500">
                        Before shipping and tax · {detail.stats?.cancelledOrders ?? 0} cancelled
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
                    <Link href={`/admin/products?seller=${detail.seller.id}`} className="btn-outline">
                      View their products
                    </Link>
                    <Link href={`/admin/orders?seller=${detail.seller.id}`} className="btn-primary">
                      View their orders
                    </Link>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="del-seller-title">
          <div className="card w-full max-w-md p-6">
            <h2 id="del-seller-title" className="text-lg font-semibold text-gray-900">
              {confirmDelete.force ? "This will delete real data" : "Delete this seller?"}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{confirmDelete.seller.email}</p>

            {confirmDelete.force ? (
              <>
                <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
                  {confirmDelete.message}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-gray-700">
                  <li>
                    <span className="font-semibold">{confirmDelete.counts?.products ?? 0}</span> product
                    {confirmDelete.counts?.products === 1 ? "" : "s"} removed from the catalogue
                  </li>
                  <li>
                    <span className="font-semibold">{confirmDelete.counts?.orders ?? 0}</span> order
                    {confirmDelete.counts?.orders === 1 ? "" : "s"} and their history deleted
                  </li>
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm text-gray-600">
                Disabling is usually better — it hides their products without destroying order history.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn-outline" disabled={Boolean(busyId)}>
                Cancel
              </button>
              {confirmDelete.force ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      const target = confirmDelete.seller;
                      setConfirmDelete(null);
                      await toggleStatus(target);
                    }}
                    className="btn-outline"
                    disabled={Boolean(busyId)}
                  >
                    Disable instead
                  </button>
                  <button type="button" onClick={() => runDelete(true)} className="btn-danger" disabled={Boolean(busyId)}>
                    {busyId ? "Deleting..." : "Delete everything"}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => runDelete(false)} className="btn-danger" disabled={Boolean(busyId)}>
                  {busyId ? "Deleting..." : "Delete seller"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </RoleGate>
  );
}

export default function AdminSellersPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading sellers..." />}>
      <SellersContent />
    </Suspense>
  );
}
