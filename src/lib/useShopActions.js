"use client";

/**
 * Shared client hook for the two actions every product surface needs:
 * add-to-cart and wishlist toggle.
 *
 * Centralising them means the products grid, the product detail page and the
 * wishlist page all behave identically — including the "please sign in first"
 * path, the optimistic UI state and the header badge refresh. The products grid
 * previously showed `alert("Add to cart functionality coming soon")` instead.
 */
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/providers";

/** Tell the header its badge counts are stale. */
export function notifyCountsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("shop:counts-changed"));
}

export function useShopActions() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { success, error } = useToast();

  const isAuthenticated = status === "authenticated" && Boolean(session?.user?.id);

  const [pendingProductIds, setPendingProductIds] = useState(() => new Set());
  const [savedProductIds, setSavedProductIds] = useState(() => new Set());

  const setPending = useCallback((id, value) => {
    setPendingProductIds((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /** Seed the wishlist state so hearts render filled for already-saved items. */
  const refreshSaved = useCallback(async () => {
    if (!isAuthenticated) {
      setSavedProductIds(new Set());
      return;
    }
    try {
      const data = await api.get("/api/wishlist");
      setSavedProductIds(new Set((data.items || []).map((item) => item.productId)));
    } catch {
      /* a failed badge read must never break the page */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  const requireSignIn = useCallback(() => {
    error("Please sign in to continue.", { title: "Authentication required" });
    router.push(`/login?callbackUrl=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`);
    return false;
  }, [error, router]);

  const addToCart = useCallback(
    async (productId, quantity = 1) => {
      if (!isAuthenticated) return requireSignIn();
      if (!productId) return false;

      setPending(productId, true);
      try {
        const cart = await api.post("/api/cart", { productId, quantity });
        notifyCountsChanged();
        success(`Added to cart (${cart.itemCount || quantity} item${cart.itemCount === 1 ? "" : "s"}).`, { title: "Cart updated" });
        return true;
      } catch (err) {
        error(err.message || "Could not add this item to your cart.");
        return false;
      } finally {
        setPending(productId, false);
      }
    },
    [isAuthenticated, requireSignIn, setPending, success, error]
  );

  const toggleWishlist = useCallback(
    async (productId) => {
      if (!isAuthenticated) return requireSignIn();
      if (!productId) return false;

      setPending(productId, true);
      try {
        const data = await api.patch("/api/wishlist", { productId });
        setSavedProductIds((current) => {
          const next = new Set(current);
          if (data.saved) next.add(productId);
          else next.delete(productId);
          return next;
        });
        notifyCountsChanged();
        success(data.saved ? "Saved to your wishlist." : "Removed from your wishlist.", {
          title: data.saved ? "Wishlist" : "Wishlist",
        });
        return data.saved;
      } catch (err) {
        error(err.message || "Could not update your wishlist.");
        return false;
      } finally {
        setPending(productId, false);
      }
    },
    [isAuthenticated, requireSignIn, setPending, success, error]
  );

  const moveToCart = useCallback(
    async (productId, quantity = 1) => {
      if (!isAuthenticated) return requireSignIn();

      setPending(productId, true);
      try {
        await api.put("/api/wishlist", { productId, quantity });
        setSavedProductIds((current) => {
          const next = new Set(current);
          next.delete(productId);
          return next;
        });
        notifyCountsChanged();
        success("Moved to your cart.", { title: "Wishlist" });
        return true;
      } catch (err) {
        error(err.message || "Could not move this item to your cart.");
        return false;
      } finally {
        setPending(productId, false);
      }
    },
    [isAuthenticated, requireSignIn, setPending, success, error]
  );

  return {
    isAuthenticated,
    user: session?.user || null,
    role: session?.user?.role || null,
    addToCart,
    toggleWishlist,
    moveToCart,
    refreshSaved,
    isPending: (id) => pendingProductIds.has(id),
    isSaved: (id) => savedProductIds.has(id),
  };
}

export default useShopActions;
