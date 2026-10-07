"use client";

/**
 * Seller → Orders to fulfil. Did not exist before.
 *
 * README requirements covered: view seller orders and update order status —
 * restricted to orders containing YOUR products, which the API enforces by
 * deriving sellerId from the session (it used to accept it from req.query).
 *
 * Sellers may set CONFIRMED / PROCESSING / SHIPPED / DELIVERED / CANCELLED.
 * REFUNDED is admin-only, and the legal transition map applies to sellers
 * without a `force` escape hatch. Both restrictions are enforced again in
 * orderService.updateOrderStatus().
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RoleGate from "@/components/dashboard/role-gate";
import OrderStatusModal from "@/components/dashboard/order-status-modal";
import { ErrorState, OrderStatusBadge, PageLoader, Pagination, PaymentStatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useToast } from "@/components/providers";
import { ORDER_STATUS_VALUES, ROLES, SELLER_ALLOWED_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate, primaryImage } from "@/utils/format";

function SellerOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: toastError } = useToast();

  const page = Number(searchParams.get("page")) || 1;
  const urlStatus = searchParams.get("status") || "";
  const urlSearch = searchParams.get("search") || "";

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState(urlSearch);
  const [statusOrder, setStatusOrder] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/seller/orders", {
        query: { page, status: urlStatus, search: urlSearch, limit: 10 },
      });
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || "Could not load your orders.");
      setOrders([]);
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

  function pushFilters(overrides = {}) {
    const params = new URLSearchParams({
      status: overrides.status ?? urlStatus,
      search: overrides.search ?? urlSearch,
    });
    const qs = params.toString();
    router.push(qs ? `/seller/orders?${qs}` : "/seller/orders");
  }

  const baseQuery = new URLSearchParams({ status: urlStatus, search: urlSearch }).toString();

  // Sellers cannot refund, so REFUNDED is not offered as a filter here.
  const filterStatuses = ORDER_STATUS_VALUES.filter((value) => SELLER_ALLOWED_STATUSES.includes(value));

  return (
    <RoleGate
      role={ROLES.SELLER}
      title="Seller console"
      heading="Orders"
      description={`${total} order${total === 1 ? "" : "s"} containing your products.`}
    >
      {/* Filters */}
      <div className="card mb-4 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            pushFilters({ search: search.trim() });
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-56 flex-1">
            <label htmlFor="so-search" className="label">
              Search
            </label>
            <input
              id="so-search"
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order number or customer"
            />
          </div>

          <div>
            <span className="label">Status</span>
            <div className="flex flex-wrap gap-1">
              {["", ...filterStatuses].map((value) => (
                <Link
                  key={value || "all"}
                  href={`/seller/orders?${new URLSearchParams({ status: value, search: urlSearch }).toString()}`}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    urlStatus === value ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
                  }`}
                >
                  {value ? value.charAt(0) + value.slice(1).toLowerCase() : "All"}
                </Link>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>
      </div>

      {loading && orders.length === 0 ? (
        <PageLoader label="Loading your orders..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">
          {urlStatus || urlSearch ? "No orders match those filters." : "No orders for your products yet."}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">Order</th>
                    <th className="th">Customer</th>
                    <th className="th">Items</th>
                    <th className="th">Status</th>
                    <th className="th">Payment</th>
                    <th className="th text-right">Total</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="align-top">
                      <td className="td">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                          className="font-medium text-primary hover:underline"
                          aria-expanded={expandedId === order.id}
                        >
                          {order.orderNumber}
                        </button>
                        <span className="block text-xs text-gray-400">{formatDate(order.orderDate)}</span>
                        {order.trackingNumber && <span className="mt-0.5 block font-mono text-xs text-gray-500">{order.trackingNumber}</span>}
                      </td>
                      <td className="td">
                        <span className="block truncate text-gray-900">{order.customer?.name || "—"}</span>
                        <span className="block truncate text-xs text-gray-400">{order.customer?.email}</span>
                        {order.customer?.phone && <span className="block truncate text-xs text-gray-400">{order.customer.phone}</span>}
                      </td>
                      <td className="td">
                        {expandedId === order.id ? (
                          <ul className="space-y-1.5">
                            {(order.items || []).map((item) => (
                              <li key={item.id} className="flex items-center gap-2">
                                <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-gray-100">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={primaryImage(item.image)} alt="" className="h-full w-full object-cover" />
                                </span>
                                <span className="min-w-0">
                                  <span className="line-clamp-1 block text-xs text-gray-800">{item.name}</span>
                                  <span className="block text-xs text-gray-400">
                                    {formatCurrency(item.price)} × {item.quantity}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <OrderStatusBadge value={order.status} />
                      </td>
                      <td className="td">
                        <PaymentStatusBadge value={order.paymentStatus} />
                        <span className="mt-0.5 block text-xs text-gray-400">{order.paymentMethod}</span>
                      </td>
                      <td className="td text-right font-medium">{formatCurrency(order.total)}</td>
                      <td className="td text-right">
                        <button type="button" onClick={() => setStatusOrder(order)} className="btn-outline px-2 py-1 text-xs">
                          Update status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} totalPages={totalPages} baseUrl={`/seller/orders${baseQuery ? `?${baseQuery}` : ""}`} />
        </>
      )}

      <OrderStatusModal
        open={Boolean(statusOrder)}
        order={statusOrder}
        role={ROLES.SELLER}
        endpoint="/api/seller/orders"
        onClose={() => setStatusOrder(null)}
        onSaved={load}
      />
    </RoleGate>
  );
}

export default function SellerOrdersPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading your orders..." />}>
      <SellerOrdersContent />
    </Suspense>
  );
}
