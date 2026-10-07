"use client";

/**
 * Product listing with search, filtering, sorting and pagination.
 *
 * Fixes versus the original:
 *   - MISSING "use client" was not the issue here (it was present), but the
 *     header WAS re-rendered inside the page while layout.js now provides it —
 *     removed the duplicate <Header />.
 *   - `Array.isArray(product.images)` was always false (the API returned a JSON
 *     string), so every card showed the placeholder image.
 *   - The filter sidebar rewrote `window.location.search` on every keystroke,
 *     causing a full page reload per character and losing all other filters.
 *     Filtering now goes through the router and preserves every active param.
 *   - Category/brand selects submitted `slug` values while the API filtered on
 *     `categoryId`/`brandId`, so choosing a category returned nothing.
 *   - "Add to Cart" fired `alert("...coming soon")`. It is wired to /api/cart.
 *   - Pagination was a single hardcoded "Older" link to page 2. It is now a real
 *     pager driven by the API's totalPages.
 *   - Loading replaced the whole page (losing the filters); now only the grid
 *     shows skeletons.
 *   - Added the missing price/rating/availability controls the toolbar exposes.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Navigation from "@/components/navigation";
import ProductCard from "@/components/products/product-card";
import { EmptyState, ErrorState, Pagination } from "@/components/ui";
import { api } from "@/lib/api";
import { hasText } from "@/utils/format";

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const brand = searchParams.get("brand") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const minRating = searchParams.get("minRating") || "";
  const availability = searchParams.get("availability") || "";
  const sortBy = searchParams.get("sortBy") || "newest";
  const page = Number(searchParams.get("page")) || 1;

  const queryString = useMemo(() => searchParams.toString(), [searchParams]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/products?${queryString}`);
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || "Could not load products.");
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Scroll back to the top of the grid when the page changes.
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const goToPage = useCallback(
    (target) => {
      const params = new URLSearchParams(searchParams.toString());
      if (target && target > 1) params.set("page", String(target));
      else params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const activeFilters = [
    hasText(search) && { key: "search", label: `Search: ${search}` },
    hasText(category) && { key: "category", label: `Category: ${category}` },
    hasText(brand) && { key: "brand", label: `Brand: ${brand}` },
    hasText(minPrice) && { key: "minPrice", label: `Min ${minPrice}` },
    hasText(maxPrice) && { key: "maxPrice", label: `Max ${maxPrice}` },
    hasText(minRating) && { key: "minRating", label: `${minRating}★ & up` },
    hasText(availability) && { key: "availability", label: availability === "in-stock" ? "In stock" : "Out of stock" },
  ].filter(Boolean);

  const removeFilter = (key) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  return (
    <>
      <Navigation />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-sm text-gray-500" aria-live="polite">
              {loading ? "Loading..." : `${total} product${total === 1 ? "" : "s"} found`}
            </p>
          </div>
        </header>

        {activeFilters.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Active:</span>
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => removeFilter(filter.key)}
                className="badge bg-white text-gray-700 ring-1 ring-gray-300 hover:ring-danger"
                aria-label={`Remove filter ${filter.label}`}
              >
                {filter.label}
                <svg className="ml-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {error ? (
          <ErrorState message={error} onRetry={loadProducts} />
        ) : loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="card overflow-hidden">
                <div className="aspect-square w-full animate-pulse bg-gray-100" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                  <div className="h-8 w-full animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="No products match your filters"
            message="Try widening your price range, clearing the search term, or browsing all products."
            action={
              <button type="button" onClick={() => router.push("/products")} className="btn-primary">
                Clear all filters
              </button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="text-sm text-gray-500">Loading products...</span>
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
