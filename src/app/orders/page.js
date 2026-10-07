"use client";

/**
 * Order history for the signed-in customer.
 *
 * Did not exist before — the README lists "Orders: View order history, track
 * order status, cancel orders" as a customer feature and orderService had
 * getOrdersByUser(), but there was no page and no /api/orders route.
 *
 * The API returns only the caller's own orders (enforced server-side by session),
 * so this page needs no client-side filtering to stay private.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Navigation from "@/components/navigation";
import { EmptyState, ErrorState, OrderStatusBadge, PageLoader, Pagination, PaymentStatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, primaryImage } from "@/utils/format";
import { ORDER_STATUS_VALUES } from "@/lib/constants";

function OrdersContent() {
  const { status: sessionStatus } = useSession();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const page = Number(searchParams.get("page")) || 1;
  const statusFilter = searchParams.get("status") || "";
  const justPlaced = searchParams.get("placed") === "1";

  const isAuthenticated = sessionStatus === "authenticated";

  const load = useCallback(async () => {
    if (sessionStatus === "loading") return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/orders", { query: { page, status: statusFilter } });
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || "Could not load your orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, page, sessionStatus, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  if (sessionStatus === "loading" || loading) {
    return (
      <>
        <Navigation />
        <PageLoader label="Loading your orders..." />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Navigation />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <EmptyState
            title="Sign in to see your orders"
            message="Your order history is attached to your account."
            action={
              <Link href="/login?callbackUrl=/orders" className="btn-primary">
                Sign in
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your orders</h1>
          <p className="text-sm text-gray-500">
            {total} order{total === 1 ? "" : "s"} placed
            {statusFilter && ` with status ${statusFilter.toLowerCase()}`}
          </p>
        </header>

        {justPlaced && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3" role="status">
            <p className="text-sm font-medium text-green-900">Thank you — your order has been placed.</p>
            <p className="mt-0.5 text-xs text-green-800">
              Payment was simulated (no real gateway is configured). You can track its progress below.
            </p>
          </div>
        )}

        {/* Status filter */}
        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href="/orders"
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              !statusFilter ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
            }`}
          >
            All
          </Link>
          {ORDER_STATUS_VALUES.map((value) => (
            <Link
              key={value}
              href={`/orders?status=${value}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                statusFilter === value
                  ? "border-primary bg-primary text-white"
                  : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
              }`}
            >
              {value.toLowerCase()}
            </Link>
          ))}
        </div>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : orders.length === 0 ? (
          <EmptyState
            title={statusFilter ? `No ${statusFilter.toLowerCase()} orders` : "No orders yet"}
            message={statusFilter ? "Try a different status filter." : "When you place an order it will appear here with live tracking."}
            action={
              <Link href="/products" className="btn-primary">
                Start shopping
              </Link>
            }
          />
        ) : (
          <>
            <ul className="space-y-4">
              {orders.map((order) => (
                <li key={order.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{order.orderNumber}</p>
                      <p className="text-xs text-gray-500">
                        Placed {formatDate(order.orderDate, { dateStyle: "medium" })}
                        {order.seller?.name && <> · Sold by {order.seller.name}</>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderStatusBadge value={order.status} />
                      <PaymentStatusBadge value={order.paymentStatus} />
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(order.total)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="flex -space-x-3">
                      {(order.items || []).slice(0, 4).map((item) => (
                        <span key={item.id} className="h-12 w-12 overflow-hidden rounded-md border-2 border-white bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={primaryImage(item.image)} alt={item.name} className="h-full w-full object-cover" />
                        </span>
                      ))}
                      {order.items?.length > 4 && (
                        <span className="flex h-12 w-12 items-center justify-center rounded-md border-2 border-white bg-gray-200 text-xs font-medium text-gray-700">
                          +{order.items.length - 4}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-700">
                        {(order.items || []).map((item) => `${item.name} × ${item.quantity}`).join(", ")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                        {order.trackingNumber && <> · Tracking {order.trackingNumber}</>}
                      </p>
                    </div>

                    <Link href={`/orders/${order.id}`} className="btn-outline shrink-0 px-3 py-1.5">
                      Track order
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={page}
              totalPages={totalPages}
              baseUrl={statusFilter ? `/orders?status=${statusFilter}` : "/orders"}
            />
          </>
        )}
      </div>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading your orders..." />}>
      <OrdersContent />
    </Suspense>
  );
}
