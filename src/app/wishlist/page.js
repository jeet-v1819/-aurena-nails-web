"use client";

/**
 * Wishlist — did not exist before.
 *
 * The README lists "Wishlist management" under customer features and
 * wishlistService was fully implemented, but there was no page and no route to
 * view it, so the heart icon in the header linked nowhere useful.
 *
 * Actions go through useShopActions so the header badge, toasts and sign-in
 * redirect all stay consistent with the rest of the shop.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Navigation from "@/components/navigation";
import { EmptyState, ErrorState, PageLoader, RatingStars } from "@/components/ui";
import { api } from "@/lib/api";
import { useShopActions, notifyCountsChanged } from "@/lib/useShopActions";
import { useToast } from "@/components/providers";
import { formatCurrency, formatDate } from "@/utils/format";

export default function WishlistPage() {
  const { status: sessionStatus } = useSession();
  const { toggleWishlist, moveToCart, isPending } = useShopActions();
  const { success, error: toastError } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [busyIds, setBusyIds] = useState(() => new Set());

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
      const data = await api.get("/api/wishlist");
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || "Could not load your wishlist.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, sessionStatus]);

  useEffect(() => {
    load();
  }, [load]);

  function markBusy(id, value) {
    setBusyIds((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleRemove(item) {
    markBusy(item.productId, true);
    await toggleWishlist(item.productId);
    markBusy(item.productId, false);
    await load();
  }

  async function handleMoveToCart(item) {
    if (!item.inStock) {
      toastError("This item is out of stock, so it cannot be moved to your cart yet.");
      return;
    }
    markBusy(item.productId, true);
    await moveToCart(item.productId, 1);
    markBusy(item.productId, false);
    await load();
  }

  async function handleClear() {
    setClearing(true);
    try {
      const data = await api.del("/api/wishlist", { query: { clear: "1" } });
      setItems(data.items || []);
      notifyCountsChanged();
      success("Your wishlist has been cleared.");
    } catch (err) {
      toastError(err.message || "Could not clear your wishlist.");
    } finally {
      setClearing(false);
    }
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <>
        <Navigation />
        <PageLoader label="Loading your wishlist..." />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Navigation />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <EmptyState
            title="Sign in to see your wishlist"
            message="Saved items are attached to your account so they follow you between devices."
            action={
              <Link href="/login?callbackUrl=/wishlist" className="btn-primary">
                Sign in
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const inStockCount = items.filter((item) => item.inStock).length;

  return (
    <>
      <Navigation />

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your wishlist</h1>
            <p className="text-sm text-gray-500">
              {items.length} saved item{items.length === 1 ? "" : "s"}
              {items.length > 0 && <> · {inStockCount} in stock</>}
            </p>
          </div>

          {items.length > 0 && (
            <button type="button" onClick={handleClear} disabled={clearing} className="btn-outline border-danger text-danger hover:border-danger hover:text-danger">
              {clearing ? "Clearing..." : "Clear wishlist"}
            </button>
          )}
        </header>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            message="Tap the heart on any product to keep an eye on it here."
            action={
              <Link href="/products" className="btn-primary">
                Browse products
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const busy = busyIds.has(item.productId) || isPending(item.productId);
              return (
                <li key={item.id} className="card flex flex-col overflow-hidden">
                  <Link href={`/product/${item.productId}`} className="group relative block aspect-[4/3] overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {!item.inStock && (
                      <span className="absolute left-2 top-2 badge bg-gray-900/80 text-white">
                        {item.stock <= 0 ? "Out of stock" : "Unavailable"}
                      </span>
                    )}
                    {item.discount > 0 && item.inStock && (
                      <span className="absolute left-2 top-2 badge bg-danger text-white">−{Math.round(Number(item.discount) || 0)}%</span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    {item.sellerName && <p className="text-xs text-gray-500">Sold by {item.sellerName}</p>}
                    <Link href={`/product/${item.productId}`} className="mt-0.5 line-clamp-2 text-sm font-medium text-gray-900 hover:text-primary hover:underline">
                      {item.name}
                    </Link>

                    <div className="mt-1 flex items-center gap-1">
                      <RatingStars value={item.averageRating} size="sm" />
                      <span className="text-xs text-gray-400">{Number(item.averageRating || 0).toFixed(1)}</span>
                    </div>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-bold text-primary">{formatCurrency(item.unitPrice)}</span>
                      {item.discount > 0 && <span className="text-sm text-gray-400 line-through">{formatCurrency(item.price)}</span>}
                    </div>

                    <p className="mt-1 text-xs text-gray-400">Saved {formatDate(item.addedAt, { dateStyle: "medium" })}</p>

                    <div className="mt-4 flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleMoveToCart(item)}
                        disabled={busy || !item.inStock}
                        className="btn-primary flex-1 px-3 py-2 text-sm"
                      >
                        {busy ? "Working..." : "Move to cart"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(item)}
                        disabled={busy}
                        aria-label={`Remove ${item.name} from wishlist`}
                        className="btn-outline px-3 py-2 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
