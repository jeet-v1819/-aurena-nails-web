"use client";

/**
 * Category bar + product filter/sort toolbar.
 *
 * Fixes versus the original:
 *   - MISSING "use client" (it uses useState/useEffect/useRouter/usePathname),
 *     which is a hard `next build` failure under the App Router.
 *   - The component declared a full `filters` state object and an
 *     `applyFilters()` that pushed them to /products, but it never rendered a
 *     single input — so search/filter/sort were unreachable. The controls are
 *     now actually rendered and wired to the same state and URL contract the
 *     products page reads.
 *   - Role came from `localStorage.getItem("userRole")`, which nothing ever
 *     wrote. It now uses the NextAuth session.
 *   - `hover underline` (invalid, space instead of colon) -> `hover:underline`.
 *   - The duplicated logo/search now live only in the header; this bar focuses
 *     on categories and filters, removing the redundant second brand block.
 *   - `localStorage` was touched during render-effect without a guard; session
 *     usage makes that moot and keeps SSR/CSR markup identical.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { ROLES } from "@/lib/constants";

const EMPTY_FILTERS = {
  search: "",
  category: "",
  brand: "",
  minPrice: "",
  maxPrice: "",
  minRating: "",
  availability: "",
  sortBy: "newest",
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "popular", label: "Most viewed" },
  { value: "name", label: "Name A-Z" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "4", label: "4 stars & up" },
  { value: "3", label: "3 stars & up" },
  { value: "2", label: "2 stars & up" },
  { value: "1", label: "1 star & up" },
];

const AVAILABILITY_OPTIONS = [
  { value: "", label: "Any availability" },
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
];

/** Which query params this toolbar owns. */
const FILTER_KEYS = Object.keys(EMPTY_FILTERS);

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const user = session?.user || null;
  const isCatalogueRoute = pathname === "/products" || pathname === "/categories";

  // Seed the toolbar from the current URL so filters survive navigation/refresh.
  const readFiltersFromUrl = useCallback(() => {
    const next = { ...EMPTY_FILTERS };
    FILTER_KEYS.forEach((key) => {
      const value = searchParams?.get(key);
      if (value) next[key] = value;
    });
    setFilters(next);
  }, [searchParams]);

  useEffect(() => {
    readFiltersFromUrl();
  }, [readFiltersFromUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadTaxonomies() {
      try {
        const [categoryData, brandData] = await Promise.all([api.get("/api/categories"), api.get("/api/brands")]);
        if (cancelled) return;
        setCategories(Array.isArray(categoryData) ? categoryData : []);
        setBrands(Array.isArray(brandData) ? brandData : []);
      } catch {
        if (!cancelled) {
          setCategories([]);
          setBrands([]);
        }
      }
    }

    loadTaxonomies();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFilterCount = useMemo(
    () => FILTER_KEYS.filter((key) => key !== "sortBy" && filters[key]).length,
    [filters]
  );

  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));

  /** Push the current filters to /products, preserving unrelated params. */
  const applyFilters = useCallback(
    (nextFilters = filters) => {
      const params = new URLSearchParams();
      FILTER_KEYS.forEach((key) => {
        const value = nextFilters[key];
        if (value && !(key === "sortBy" && value === EMPTY_FILTERS.sortBy)) params.set(key, value);
      });

      const query = params.toString();
      router.push(query ? `/products?${query}` : "/products");
      setIsPanelOpen(false);
    },
    [filters, router]
  );

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    // Keep the user on /products but drop every filter param.
    router.push("/products");
    setIsPanelOpen(false);
  }, [router]);

  const dashboardHref = user?.role === ROLES.ADMIN ? "/admin" : user?.role === ROLES.SELLER ? "/seller" : null;

  return (
    <nav className="border-b border-gray-200 bg-white" aria-label="Catalogue">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Category quick links */}
        <div className="flex items-center gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href="/products"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === "/products" && !filters.category
                ? "border-primary bg-primary text-white"
                : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
            }`}
          >
            All products
          </Link>

          {categories.map((category) => {
            const active = filters.category === category.slug;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  const next = { ...EMPTY_FILTERS, category: active ? "" : category.slug };
                  setFilters(next);
                  applyFilters(next);
                }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
                }`}
              >
                {category.name}
                {typeof category._count?.products === "number" && (
                  <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-gray-400"}`}>
                    {category._count.products}
                  </span>
                )}
              </button>
            );
          })}

          {dashboardHref && (
            <Link
              href={dashboardHref}
              className="ml-auto shrink-0 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
            >
              {user?.role === ROLES.ADMIN ? "Admin" : "Seller"} dashboard
            </Link>
          )}
        </div>

        {/* Filter toolbar */}
        {isCatalogueRoute && (
          <div className="border-t border-gray-100 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPanelOpen((open) => !open)}
                aria-expanded={isPanelOpen}
                aria-controls="filter-panel"
                className="btn-outline"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Always-visible sort control */}
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span className="hidden sm:inline">Sort</span>
                <select
                  value={filters.sortBy}
                  onChange={(event) => {
                    const next = { ...filters, sortBy: event.target.value };
                    setFilters(next);
                    applyFilters(next);
                  }}
                  className="input w-auto py-1.5"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {activeFilterCount > 0 && (
                <button type="button" onClick={clearFilters} className="text-sm text-gray-500 hover:text-danger hover:underline">
                  Clear all
                </button>
              )}
            </div>

            {isPanelOpen && (
              <form
                id="filter-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyFilters();
                }}
                className="mt-3 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <div>
                  <label htmlFor="filter-search" className="label">
                    Search
                  </label>
                  <input
                    id="filter-search"
                    type="search"
                    className="input"
                    placeholder="Name, SKU or brand"
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="filter-category" className="label">
                    Category
                  </label>
                  <select
                    id="filter-category"
                    className="input"
                    value={filters.category}
                    onChange={(event) => setFilter("category", event.target.value)}
                  >
                    <option value="">All categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-brand" className="label">
                    Brand
                  </label>
                  <select
                    id="filter-brand"
                    className="input"
                    value={filters.brand}
                    onChange={(event) => setFilter("brand", event.target.value)}
                  >
                    <option value="">All brands</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.slug}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="filter-min-price" className="label">
                      Min price
                    </label>
                    <input
                      id="filter-min-price"
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="0"
                      value={filters.minPrice}
                      onChange={(event) => setFilter("minPrice", event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="filter-max-price" className="label">
                      Max price
                    </label>
                    <input
                      id="filter-max-price"
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      placeholder="Any"
                      value={filters.maxPrice}
                      onChange={(event) => setFilter("maxPrice", event.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="filter-rating" className="label">
                    Minimum rating
                  </label>
                  <select
                    id="filter-rating"
                    className="input"
                    value={filters.minRating}
                    onChange={(event) => setFilter("minRating", event.target.value)}
                  >
                    {RATING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-availability" className="label">
                    Availability
                  </label>
                  <select
                    id="filter-availability"
                    className="input"
                    value={filters.availability}
                    onChange={(event) => setFilter("availability", event.target.value)}
                  >
                    {AVAILABILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                  <button type="submit" className="btn-primary">
                    Apply filters
                  </button>
                  <button type="button" onClick={clearFilters} className="btn-outline">
                    Reset
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
