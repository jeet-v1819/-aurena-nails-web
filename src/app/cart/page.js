"use client";

/**
 * Shopping cart.
 *
 * The previous version was a localStorage demo — it read `localStorage.getItem("cart")`,
 * which nothing in the app ever wrote, so the page always rendered "Your cart is
 * empty". It also had no quantity controls, no remove button, no totals and no
 * path to checkout, despite cartService.js and /api/cart being fully implemented.
 *
 * It is now wired to the real /api/cart endpoint: line items come from the
 * database, quantity changes and removals persist, totals (subtotal, discount,
 * shipping, tax, total) come from the server so they always match what checkout
 * will charge, and stock problems are surfaced inline.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Navigation from "@/components/navigation";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui";
import { api } from "@/lib/api";
import { notifyCountsChanged } from "@/lib/useShopActions";
import { useToast } from "@/components/providers";
import { formatCurrency, primaryImage } from "@/utils/format";

function CartContent() {
  const { status } = useSession();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyProductId, setBusyProductId] = useState(null);

  const isAuthenticated = status === "authenticated";

  const load = useCallback(async () => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      setCart(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/cart");
      setCart(data);
    } catch (err) {
      setError(err.message || "Could not load your cart.");
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateQuantity(productId, quantity) {
    setBusyProductId(productId);
    try {
      const data = await api.put("/api/cart", { productId, quantity });
      setCart(data);
      notifyCountsChanged();
    } catch (err) {
      toastError(err.message || "Could not update that item.");
    } finally {
      setBusyProductId(null);
    }
  }

  async function removeItem(productId) {
    setBusyProductId(productId);
    try {
      const data = await api.del(`/api/cart?productId=${encodeURIComponent(productId)}`);
      setCart(data);
      notifyCountsChanged();
      success("Item removed from your cart.");
    } catch (err) {
      toastError(err.message || "Could not remove that item.");
    } finally {
      setBusyProductId(null);
    }
  }

  async function clearCart() {
    try {
      const data = await api.del("/api/cart?clear=1");
      setCart(data);
      notifyCountsChanged();
      success("Your cart has been emptied.");
    } catch (err) {
      toastError(err.message || "Could not clear your cart.");
    }
  }

  if (status === "loading" || loading) {
    return (
      <>
        <Navigation />
        <PageLoader label="Loading your cart..." />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Navigation />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <EmptyState
            title="Sign in to view your cart"
            message="Your cart is saved to your account so you can pick it up on any device."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/login?callbackUrl=/cart" className="btn-primary">
                  Sign in
                </Link>
                <Link href="/register" className="btn-outline">
                  Create an account
                </Link>
              </div>
            }
          />
        </div>
      </>
    );
  }

  const items = cart?.items || [];
  const isEmpty = items.length === 0;

  return (
    <>
      <Navigation />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shopping cart</h1>
            <p className="text-sm text-gray-500">
              {cart?.itemCount || 0} item{(cart?.itemCount || 0) === 1 ? "" : "s"}
              {items.length > 1 && ` from ${new Set(items.map((item) => item.sellerId)).size} seller(s)`}
            </p>
          </div>
          {!isEmpty && (
            <div className="flex gap-2">
              <Link href="/products" className="btn-outline">
                Continue shopping
              </Link>
              <button type="button" onClick={clearCart} className="btn-ghost text-danger hover:bg-red-50 hover:text-danger">
                Clear cart
              </button>
            </div>
          )}
        </header>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : isEmpty ? (
          <EmptyState
            title="Your cart is empty"
            message="Browse the catalogue and add something you like — it will show up here."
            action={
              <Link href="/products" className="btn-primary">
                Continue shopping
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Line items */}
            <ul className="space-y-3 lg:col-span-2">
              {items.map((item) => {
                const busy = busyProductId === item.productId;
                const image = primaryImage(item.image);

                return (
                  <li key={item.id} className="card flex gap-4 p-4">
                    <Link href={`/product/${item.productId}`} className="block h-24 w-24 shrink-0 overflow-hidden rounded-md bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src = "/placeholder-product.svg";
                        }}
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/product/${item.productId}`} className="line-clamp-2 text-sm font-medium text-gray-900 hover:text-primary hover:underline">
                            {item.name}
                          </Link>
                          {item.sellerName && <p className="mt-0.5 text-xs text-gray-500">Sold by {item.sellerName}</p>}
                          <p className="mt-1 text-sm text-gray-600">
                            {formatCurrency(item.unitPrice)} each
                            {item.hasDiscount && <span className="ml-2 text-xs text-gray-400 line-through">{formatCurrency(item.listPrice)}</span>}
                          </p>
                        </div>

                        <p className="shrink-0 text-right text-base font-bold text-gray-900">{formatCurrency(item.lineTotal)}</p>
                      </div>

                      {(item.exceedsStock || item.unavailable) && (
                        <p className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-danger" role="alert">
                          {item.unavailable
                            ? "This product is no longer available. Please remove it to continue."
                            : `Only ${item.stock} available — reduce the quantity to continue.`}
                        </p>
                      )}

                      <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                        <div className="flex items-center rounded-md border border-gray-300">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            disabled={busy}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="px-2.5 py-1.5 text-gray-600 transition-colors hover:text-primary disabled:opacity-40"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, item.stock)}
                            value={item.quantity}
                            disabled={busy}
                            onChange={(event) => {
                              const next = Number.parseInt(event.target.value, 10);
                              if (Number.isFinite(next) && next >= 1) updateQuantity(item.productId, next);
                            }}
                            aria-label={`Quantity of ${item.name}`}
                            className="w-12 border-x border-gray-300 py-1.5 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={busy || item.quantity >= item.stock}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="px-2.5 py-1.5 text-gray-600 transition-colors hover:text-primary disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          disabled={busy}
                          className="text-xs text-gray-500 transition-colors hover:text-danger hover:underline disabled:opacity-40"
                        >
                          {busy ? "Updating..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Summary */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="card p-5">
                <h2 className="text-base font-semibold text-gray-900">Order summary</h2>

                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Subtotal</dt>
                    <dd className="font-medium text-gray-900">{formatCurrency(cart?.subtotal)}</dd>
                  </div>

                  {Number(cart?.discount) > 0 && (
                    <div className="flex justify-between text-green-700">
                      <dt>Discount</dt>
                      <dd className="font-medium">−{formatCurrency(cart?.discount)}</dd>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <dt className="text-gray-600">Shipping</dt>
                    <dd className="font-medium text-gray-900">
                      {Number(cart?.shipping) === 0 ? <span className="text-green-700">Free</span> : formatCurrency(cart?.shipping)}
                    </dd>
                  </div>

                  <div className="flex justify-between">
                    <dt className="text-gray-600">Estimated tax</dt>
                    <dd className="font-medium text-gray-900">{formatCurrency(cart?.tax)}</dd>
                  </div>

                  <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-base">
                    <dt className="font-semibold text-gray-900">Total</dt>
                    <dd className="font-bold text-primary">{formatCurrency(cart?.total)}</dd>
                  </div>
                </dl>

                {cart?.freeShippingThreshold > 0 && Number(cart?.shipping) > 0 && (
                  <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Spend {formatCurrency(cart.freeShippingThreshold - cart.subtotal)} more for free shipping.
                  </p>
                )}

                {cart?.hasIssues && (
                  <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-danger" role="alert">
                    Some items need your attention before you can check out.
                  </p>
                )}

                <button
                  type="button"
                  disabled={Boolean(cart?.hasIssues)}
                  onClick={() => router.push("/checkout")}
                  className="btn-primary mt-4 w-full py-2.5"
                >
                  Proceed to checkout
                </button>

                <p className="mt-3 text-center text-xs text-gray-500">
                  Multi-vendor checkout: items from different sellers become separate orders.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading your cart..." />}>
      <CartContent />
    </Suspense>
  );
}
