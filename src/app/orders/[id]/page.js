"use client";

/**
 * Order detail + tracking.
 *
 * Did not exist before. Implements the README's "Customer order tracking" and
 * "Cancel orders" features on top of the existing orderService functions
 * (getOrderById / getOrderTimeline / cancelOrder), which had no UI or route.
 *
 * Access is enforced by /api/orders/[id]: the customer who placed the order, the
 * seller who fulfils it, or an admin. Anyone else receives a 404, so this page
 * cannot be used to enumerate other people's orders.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Navigation from "@/components/navigation";
import { ErrorState, OrderStatusBadge, PageLoader, PaymentStatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useToast } from "@/components/providers";
import { formatCurrency, formatDate, primaryImage } from "@/utils/format";
import { CANCELLABLE_ORDER_STATUSES, ORDER_STATUS_FLOW, ROLES } from "@/lib/constants";

function StepIcon({ state }) {
  if (state === "done") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-primary bg-white" aria-hidden="true" />
    );
  }
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 bg-white text-gray-400" aria-hidden="true" />;
}

function OrderDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const { success, error: toastError } = useToast();

  const orderId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : null;

  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) {
      setError("This order does not exist.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/orders/${encodeURIComponent(orderId)}`);
      setOrder(data.order);
      setTimeline(data.timeline || []);
    } catch (err) {
      setError(err.status === 404 ? "We could not find that order." : err.message || "Could not load this order.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel() {
    setCancelling(true);
    try {
      const data = await api.patch(`/api/orders/${encodeURIComponent(orderId)}`, { reason: "Cancelled by customer" });
      setOrder(data.order);
      setConfirmOpen(false);
      success("Your order has been cancelled and stock returned.", { title: "Order cancelled" });
      await load();
    } catch (err) {
      toastError(err.message || "Could not cancel this order.");
    } finally {
      setCancelling(false);
    }
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <>
        <Navigation />
        <PageLoader label="Loading order..." />
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <Navigation />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <ErrorState title="Order unavailable" message={error} onRetry={load} />
          <div className="mt-6 text-center">
            <Link href="/orders" className="btn-outline">
              Back to order history
            </Link>
          </div>
        </div>
      </>
    );
  }

  const user = session?.user;
  const isOwner = user?.id === order.userId;
  const isSeller = user?.id === order.sellerId;
  const isAdmin = user?.role === ROLES.ADMIN;
  const canCancel = isOwner && CANCELLABLE_ORDER_STATUSES.includes(order.status);

  // Where are we in the fulfilment lifecycle?
  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const isTerminal = order.status === "CANCELLED" || order.status === "REFUNDED";

  return (
    <>
      <Navigation />

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-gray-500">
          <Link href="/orders" className="hover:text-primary hover:underline">
            ← Back to orders
          </Link>
        </nav>

        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Placed {formatDate(order.orderDate)} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
              {order.seller?.name && <> · Sold by {order.seller.name}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge value={order.status} />
            <PaymentStatusBadge value={order.paymentStatus} />
            {canCancel && (
              <button type="button" onClick={() => setConfirmOpen(true)} className="btn-outline border-danger text-danger hover:border-danger hover:text-danger">
                Cancel order
              </button>
            )}
          </div>
        </header>

        {searchParams.get("placed") === "1" && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3" role="status">
            <p className="text-sm font-medium text-green-900">Order placed successfully.</p>
            <p className="mt-0.5 text-xs text-green-800">
              Payment was simulated — no real payment gateway is configured in this project.
              {Number(searchParams.get("count")) > 1 &&
                ` Your cart spanned several sellers, so ${searchParams.get("count")} separate orders were created.`}
            </p>
          </div>
        )}

        {/* Tracking */}
        <section className="card mb-6 p-5">
          <h2 className="text-base font-semibold text-gray-900">Tracking</h2>

          {isTerminal ? (
            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">
                This order was {order.status.toLowerCase()}.
              </p>
              {order.cancelledAt && <p className="mt-0.5 text-xs text-gray-500">Cancelled {formatDate(order.cancelledAt)}.</p>}
            </div>
          ) : (
            <ol className="mt-5">
              {ORDER_STATUS_FLOW.map((step, index) => {
                const state = currentIndex < 0 ? "todo" : index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
                const event = timeline.find((entry) => entry.status === step);

                return (
                  <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
                    {index < ORDER_STATUS_FLOW.length - 1 && (
                      <span
                        className={`absolute left-4 top-8 h-full w-0.5 ${index < currentIndex ? "bg-primary" : "bg-gray-200"}`}
                        aria-hidden="true"
                      />
                    )}
                    <StepIcon state={state} />
                    <div className="min-w-0 pt-1">
                      <p className={`text-sm font-medium ${state === "todo" ? "text-gray-400" : "text-gray-900"}`}>
                        {step.charAt(0) + step.slice(1).toLowerCase()}
                      </p>
                      {event && (
                        <>
                          <p className="mt-0.5 text-xs text-gray-500">{event.note}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{formatDate(event.createdAt)}</p>
                        </>
                      )}
                      {step === ORDER_STATUS.SHIPPED && order.trackingNumber && (
                        <p className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                          {order.trackingNumber}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Items */}
          <section className="card p-5 lg:col-span-2">
            <h2 className="text-base font-semibold text-gray-900">Items</h2>
            <ul className="mt-4 divide-y divide-gray-100">
              {(order.items || []).map((item) => (
                <li key={item.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={primaryImage(item.image)} alt={item.name} className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.productId ? (
                      <Link href={`/product/${item.productId}`} className="line-clamp-2 text-sm font-medium text-gray-900 hover:text-primary hover:underline">
                        {item.name}
                      </Link>
                    ) : (
                      <span className="line-clamp-2 text-sm font-medium text-gray-900">{item.name}</span>
                    )}
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {formatCurrency(item.price)} each · Qty {item.quantity}
                      {item.sellerName && <> · Sold by {item.sellerName}</>}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-gray-900">{formatCurrency(item.total)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Subtotal</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(order.subtotal)}</dd>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-green-700">
                  <dt>Discount</dt>
                  <dd className="font-medium">−{formatCurrency(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-600">Shipping</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(order.shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Tax</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(order.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base">
                <dt className="font-semibold text-gray-900">Total</dt>
                <dd className="font-bold text-primary">{formatCurrency(order.total)}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-gray-500">
              Payment method: {order.paymentMethod} · {order.paymentStatus.toLowerCase()}
              {order.paymentMethod !== "COD" && " (simulated — no real gateway configured)"}
            </p>
          </section>

          {/* Shipping + activity */}
          <div className="space-y-6">
            <section className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">Shipping address</h2>
              {order.shippingAddress ? (
                <address className="mt-3 space-y-0.5 text-sm not-italic text-gray-600">
                  {order.shippingAddress.split("|").map((part, index) => (
                    <span key={index} className="block">
                      {part.trim()}
                    </span>
                  ))}
                </address>
              ) : (
                <p className="mt-3 text-sm text-gray-500">No address recorded.</p>
              )}
              {order.notes && (
                <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <span className="font-medium">Notes:</span> {order.notes}
                </p>
              )}
            </section>

            {timeline.length > 0 && (
              <section className="card p-5">
                <h2 className="text-base font-semibold text-gray-900">Activity</h2>
                <ul className="mt-3 space-y-3">
                  {[...timeline].reverse().map((event) => (
                    <li key={event.id} className="text-xs">
                      <p className="font-medium text-gray-900">{event.note || event.status}</p>
                      <p className="mt-0.5 text-gray-500">
                        {formatDate(event.createdAt)}
                        {event.actor?.name && <> · {event.actor.name}</>}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(isSeller || isAdmin) && (
              <section className="card border-blue-200 bg-blue-50 p-5">
                <h2 className="text-sm font-semibold text-blue-900">Managing this order?</h2>
                <p className="mt-1 text-xs text-blue-800">Update its status from your dashboard.</p>
                <Link href={isAdmin ? `/admin/orders?id=${order.id}` : "/seller/orders"} className="btn-outline mt-3 w-full border-blue-300 text-blue-900 hover:border-blue-500 hover:text-blue-900">
                  {isAdmin ? "Open admin orders" : "Open seller orders"}
                </Link>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <div className="card w-full max-w-md p-6">
            <h2 id="cancel-title" className="text-lg font-semibold text-gray-900">
              Cancel this order?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Order <span className="font-medium">{order.orderNumber}</span> ({formatCurrency(order.total)}) will be
              cancelled and its items returned to stock. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={cancelling} className="btn-outline">
                Keep order
              </button>
              <button type="button" onClick={handleCancel} disabled={cancelling} className="btn-danger">
                {cancelling ? "Cancelling..." : "Yes, cancel order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading order..." />}>
      <OrderDetailContent />
    </Suspense>
  );
}
