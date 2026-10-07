"use client";

/**
 * Category browser — did not exist before.
 *
 * The README lists "Category and brand browsing" and the header linked to
 * /categories, but there was no such page. This renders the existing public
 * GET /api/categories payload (which already includes product counts) and links
 * through to the filtered product listing.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/components/navigation";
import { ErrorState, PageLoader } from "@/components/ui";
import { api } from "@/lib/api";

const TILE_TINTS = [
  "from-emerald-50 to-emerald-100",
  "from-amber-50 to-amber-100",
  "from-sky-50 to-sky-100",
  "from-rose-50 to-rose-100",
  "from-violet-50 to-violet-100",
  "from-lime-50 to-lime-100",
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Could not load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <>
        <Navigation />
        <PageLoader label="Loading categories..." />
      </>
    );
  }

  const totalProducts = categories.reduce((sum, category) => sum + (category._count?.products || 0), 0);

  return (
    <>
      <Navigation />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Shop by category</h1>
          <p className="mt-1 text-sm text-gray-500">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"} · {totalProducts} product
            {totalProducts === 1 ? "" : "s"} listed
          </p>
        </header>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : categories.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-gray-600">No categories yet.</p>
            <p className="mt-1 text-xs text-gray-500">
              Run <code className="rounded bg-gray-100 px-1">npm run db:seed</code> to load the sample catalogue.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => {
              const count = category._count?.products || 0;
              const tint = TILE_TINTS[index % TILE_TINTS.length];

              return (
                <li key={category.id}>
                  <Link
                    href={`/products?category=${encodeURIComponent(category.id)}`}
                    className="card group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <span className={`flex h-28 items-center justify-center bg-gradient-to-br ${tint}`}>
                      {category.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={category.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-3xl font-black text-gray-300 transition-transform duration-300 group-hover:scale-110" aria-hidden="true">
                          {(category.name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>

                    <span className="flex flex-1 flex-col p-4">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold text-gray-900 group-hover:text-primary">{category.name}</span>
                        <span className="badge shrink-0 bg-gray-100 text-gray-600">
                          {count} product{count === 1 ? "" : "s"}
                        </span>
                      </span>
                      {category.description && (
                        <span className="mt-1 line-clamp-2 text-sm text-gray-500">{category.description}</span>
                      )}
                      <span className="mt-3 text-xs font-medium text-primary">Browse {category.name} →</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
