"use client";

/**
 * Admin → Order management. Did not exist before.
 *
 * README requirements covered: order management, search/filter orders and update
 * order status. Admins get the full status list including REFUNDED, and the
 * `force` escape hatch for correcting data that is already in an illegal state —
 * both are enforced again server-side by orderService.updateOrderStatus().
 *
 * Every status change writes an OrderEvent, so the customer-facing tracking
 * timeline at /orders/[id] updates from here too.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RoleGate from "@/components/dashboard/role-gate";
import OrderStatusModal from "@/components/dashboard/order-status-modal";
import { ErrorState, OrderStatusBadge, PageLoader, Pagination, PaymentStatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useToast } from "@/components/providers";
import { ORDER_STATUS_VALUES, PAYMENT_STATUS_VALUES, ROLES } from "@/lib/constants";
import { formatCurrency, formatDate, primaryImage } from "@/utils/format";

function AdminOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: toastError } = useToast();

  const page = Number(searchParams.get("page")) || 1;
  const urlSearch = searchParams.get("search") || "";
  const urlStatus = searchParams.get("status") || "";
  const urlPayment = searchParams.get("paymentStatus") || "";
  const urlSeller = searchParams.get("seller") || "";
  const urlFrom = searchParams.get("from") || "";
  const urlTo = searchParams.get("to") || "";
  const urlId = searchParams.get("id") || "";

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sellers, setSellers] = useState([]);

  const [search, setSearch] = useState(urlSearch);
  const [busyId, setBusyId] = useState(null);

  const [statusOrder, setStatusOrder] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/admin/orders", {
        query: {
          page,
          search: urlSearch,
          status: urlStatus,
          paymentStatus: urlPayment,
          seller: urlSeller,
          from: urlFrom,
          to: urlTo,
          limit: 10,
        },
      });
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || "Could not load orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, urlFrom, urlPayment, urlSearch, urlSeller, urlStatus, urlTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    api
      .get("/api/admin/sellers", { query: { limit: 100 } })
      .then((data) => setSellers(data.sellers || []))
      .catch(() => {});
  }, []);

  // A deep link like /admin/orders?id=... opens that order straight away
  // (the seller-stats modal on /admin/sellers links here that way).
  useEffect(() => {
    if (!urlId) return;
    let cancelled = false;
    setDetailLoading(true);
    api
      .get("/api/admin/orders", { query: { id: urlId } })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) toastError(err.message || "Could not load that order.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toastError, urlId]);

  function pushFilters(overrides = {}) {
    const params = new URLSearchParams({
      search: overrides.search ?? urlSearch,
      status: overrides.status ?? urlStatus,
      paymentStatus: overrides.paymentStatus ?? urlPayment,
      seller: overrides.seller ?? urlSeller,
      from: overrides.from ?? urlFrom,
      to: overrides.to ?? urlTo,
    });
    const qs = params.toString();
    router.push(qs ? `/admin/orders?${qs}` : "/admin/orders");
  }

  async function openDetail(order) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await api.get("/api/admin/orders", { query: { id: order.id } });
      setDetail(data);
    } catch (err) {
      toastError(err.message || "Could not load that order.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function runDelete() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.order.id);
    try {
      await api.del("/api/admin/orders", { query: { id: confirmDelete.order.id } });
      success(`${confirmDelete.order.orderNumber} has been deleted.`);
      setConfirmDelete(null);
      setDetail(null);
      await load();
    } catch (err) {
      toastError(err.message || "Could not delete that order.");
    } finally {
      setBusyId(null);
    }
  }

  const baseQuery = new URLSearchParams({
    search: urlSearch,
    status: urlStatus,
    paymentStatus: urlPayment,
    seller: urlSeller,
    from: urlFrom,
    to: urlTo,
  }).toString();

  return (
    <RoleGate
      role={ROLES.ADMIN}
      title="Admin console"
      heading="Orders"
      description={`${total} order${total === 1 ? "" : "s"} match the current filters.`}
    >
      {/* Filters */}
      <div className="card mb-4 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            pushFilters({ search: search.trim() });
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        >
          <div className="lg:col-span-2">
            <label htmlFor="ao-search" className="label">
              Search
            </label>
            <input
              id="ao-search"
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order number, customer name or email"
            />
          </div>

          <div>
            <label htmlFor="ao-status" className="label">
              Status
            </label>
            <select id="ao-status" className="input" value={urlStatus} onChange={(event) => pushFilters({ status: event.target.value })}>
              <option value="">All</option>
              {ORDER_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ao-payment" className="label">
              Payment
            </label>
            <select id="ao-payment" className="input" value={urlPayment} onChange={(event) => pushFilters({ paymentStatus: event.target.value })}>
              <option value="">All</option>
              {PAYMENT_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ao-seller" className="label">
              Seller
            </label>
            <select id="ao-seller" className="input" value={urlSeller} onChange={(event) => pushFilters({ seller: event.target.value })}>
              <option value="">All</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">Date range</span>
            <span className="flex items-center gap-1">
              <input
                type="date"
                className="input flex-1"
                value={urlFrom}
                onChange={(event) => pushFilters({ from: event.target.value })}
                aria-label="From date"
              />
              <span className="text-gray-400">–</span>
              <input
                type="date"
                className="input flex-1"
                value={urlTo}
                onChange={(event) => pushFilters({ to: event.target.value })}
                aria-label="To date"
              />
            </span>
          </div>

          <div className="sm:col-span-2 lg:col-span-6">
            <span className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary">
                Apply search
              </button>
              {(urlSearch || urlStatus || urlPayment || urlSeller || urlFrom || urlTo) && (
                <Link href="/admin/orders" className="btn-outline">
                  Clear filters
                </Link>
              )}
            </span>
          </div>
        </form>
      </div>

      {loading && orders.length === 0 ? (
        <PageLoader label="Loading orders..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">No orders match those filters.</div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">Order</th>
                    <th className="th">Customer</th>
                    <th className="th">Seller</th>
                    <th className="th">Status</th>
                    <th className="th">Payment</th>
                    <th className="th text-right">Total</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className={busyId === order.id ? "opacity-60" : ""}>
                      <td className="td">
                        <button type="button" onClick={() => openDetail(order)} className="font-medium text-primary hover:underline">
                          {order.orderNumber}
                        </button>
                        <span className="block text-xs text-gray-400">{formatDate(order.orderDate)}</span>
                      </td>
                      <td className="td">
                        <span className="block truncate text-gray-900">{order.customer?.name || "—"}</span>
                        <span className="block truncate text-xs text-gray-400">{order.customer?.email}</span>
                      </td>
                      <td className="td text-xs text-gray-600">{order.seller?.name || "—"}</td>
                      <td className="td">
                        <OrderStatusBadge value={order.status} />
                      </td>
                      <td className="td">
                        <PaymentStatusBadge value={order.paymentStatus} />
                        <span className="mt-0.5 block text-xs text-gray-400">{order.paymentMethod}</span>
                      </td>
                      <td className="td text-right font-medium">{formatCurrency(order.total)}</td>
                      <td className="td">
                        <span className="flex justify-end gap-1">
                          <button type="button" onClick={() => setStatusOrder(order)} className="btn-outline px-2 py-1 text-xs" disabled={busyId === order.id}>
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ order })}
                            className="btn-ghost px-2 py-1 text-xs text-danger hover:text-danger"
                            disabled={busyId === order.id}
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

          <Pagination page={page} totalPages={totalPages} baseUrl={`/admin/orders${baseQuery ? `?${baseQuery}` : ""}`} />
        </>
      )}

      <OrderStatusModal
        open={Boolean(statusOrder)}
        order={statusOrder}
        role={ROLES.ADMIN}
        endpoint="/api/admin/orders"
        onClose={() => setStatusOrder(null)}
        onSaved={async () => {
          await load();
          if (detail?.order) await openDetail(detail.order);
        }}
      />

      {/* Order detail */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="ao-detail-title">
          <div className="card my-8 w-full max-w-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="ao-detail-title" className="text-lg font-semibold text-gray-900">
                  {detail?.order?.orderNumber || "Order"}
                </h2>
                {detail?.order && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDate(detail.order.orderDate)} · {detail.order.customer?.name} ({detail.order.customer?.email}) ·{" "}
                    {detail.order.seller?.name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setDetailLoading(false);
                  if (urlId) router.push("/admin/orders");
                }}
                aria-label="Close"
                className="btn-ghost h-8 w-8 shrink-0 rounded-full p-0"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {detailLoading ? (
              <PageLoader label="Loading order..." />
            ) : (
              detail?.order && (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <OrderStatusBadge value={detail.order.status} />
                    <PaymentStatusBadge value={detail.order.paymentStatus} />
                    <span className="badge bg-gray-100 text-gray-600">{detail.order.paymentMethod}</span>
                    {detail.order.trackingNumber && (
                      <span className="badge bg-gray-100 font-mono text-gray-700">{detail.order.trackingNumber}</span>
                    )}
                  </div>

                  <ul className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
                    {(detail.order.items || []).map((item) => (
                      <li key={item.id} className="flex items-center gap-3 py-2.5">
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={primaryImage(item.image)} alt="" className="h-full w-full object-cover" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 block text-sm text-gray-900">{item.name}</span>
                          <span className="block text-xs text-gray-400">
                            {formatCurrency(item.price)} × {item.quantity}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium text-gray-900">{formatCurrency(item.total)}</span>
                      </li>
                    ))}
                  </ul>

                  <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                    <div className="flex justify-between sm:col-span-1">
                      <dt className="text-gray-500">Subtotal</dt>
                      <dd className="font-medium">{formatCurrency(detail.order.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Discount</dt>
                      <dd className="font-medium">−{formatCurrency(detail.order.discount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Shipping</dt>
                      <dd className="font-medium">{formatCurrency(detail.order.shipping)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Tax</dt>
                      <dd className="font-medium">{formatCurrency(detail.order.tax)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-1 sm:col-span-2">
                      <dt className="font-semibold text-gray-900">Total</dt>
                      <dd className="font-bold text-primary">{formatCurrency(detail.order.total)}</dd>
                    </div>
                  </dl>

                  {detail.order.shippingAddress && (
                    <div className="mt-4 rounded-md bg-gray-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ship to</p>
                      <address className="mt-1 space-y-0.5 text-sm not-italic text-gray-700">
                        {detail.order.shippingAddress.split("|").map((part, index) => (
                          <span key={index} className="block">
                            {part.trim()}
                          </span>
                        ))}
                      </address>
                    </div>
                  )}

                  {(detail.timeline || []).length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline</p>
                      <ol className="mt-2 space-y-1.5">
                        {[...detail.timeline].reverse().map((event) => (
                          <li key={event.id} className="flex items-baseline justify-between gap-3 text-xs">
                            <span className="text-gray-700">
                              <span className="font-medium">{event.status}</span>
                              {event.note && <> — {event.note}</>}
                              {event.actor?.name && <span className="text-gray-400"> by {event.actor.name}</span>}
                            </span>
                            <span className="shrink-0 text-gray-400">{formatDate(event.createdAt)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
                    <Link href={`/orders/${detail.order.id}`} className="btn-outline">
                      Customer view
                    </Link>
                    <button type="button" onClick={() => setStatusOrder(detail.order)} className="btn-primary">
                      Update status
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="del-order-title">
          <div className="card w-full max-w-md p-6">
            <h2 id="del-order-title" className="text-lg font-semibold text-gray-900">
              Delete this order?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {confirmDelete.order.orderNumber} ({formatCurrency(confirmDelete.order.total)}) and its full timeline will
              be permanently removed. Order history is a financial record — cancelling or refunding is usually the right
              move instead.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn-outline" disabled={Boolean(busyId)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // Close this dialog first — two stacked modals would fight for
                  // focus and the Escape key.
                  const target = confirmDelete.order;
                  setConfirmDelete(null);
                  setStatusOrder(target);
                }}
                className="btn-outline"
                disabled={Boolean(busyId)}
              >
                Change status instead
              </button>
              <button type="button" onClick={runDelete} className="btn-danger" disabled={Boolean(busyId)}>
                {busyId ? "Deleting..." : "Delete order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGate>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading orders..." />}>
      <AdminOrdersContent />
    </Suspense>
  );
}
