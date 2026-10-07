"use client";

/**
 * Home page.
 *
 * The previous version was a bare centred heading ("E-commerce Platform") with
 * no data, despite the README describing a storefront home with featured
 * products. It now renders the real catalogue via the existing public APIs.
 *
 * Like every other page in this app it is a Client Component that fetches the
 * API routes, so `next build` never needs a reachable database.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/components/navigation";
import ProductCard from "@/components/products/product-card";
import { EmptyState, ErrorState } from "@/components/ui";
import { api } from "@/lib/api";

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [newest, rated, cats] = await Promise.all([
        // Newest in-stock products, highest rated, and the category strip.
        api.get("/api/products", { query: { sortBy: "newest", limit: 8, availability: "in-stock" } }),
        api.get("/api/products", { query: { sortBy: "rating", limit: 4 } }),
        api.get("/api/categories"),
      ]);

      setFeatured(newest.products || []);
      setTopRated(rated.products || []);
      setCategories(Array.isArray(cats) ? cats.slice(0, 6) : []);
    } catch (err) {
      setError(err.message || "Could not load the storefront.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Navigation />

      {/* Hero */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-16">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              Multi-vendor marketplace
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
              Shop from independent sellers, <span className="text-primary">all in one place</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-gray-600">
              Browse a curated catalogue from multiple stores, compare prices, save favourites to your wishlist and
              track every order from checkout to delivery.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary px-5 py-2.5">
                Browse products
              </Link>
              <Link href="/register" className="btn-outline px-5 py-2.5">
                Become a seller
              </Link>
            </div>

            <dl className="mt-9 grid max-w-md grid-cols-3 gap-4 border-t border-gray-200 pt-6">
              <div>
                <dt className="text-xs text-gray-500">Sellers</dt>
                <dd className="text-lg font-semibold text-gray-900">Independent</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Checkout</dt>
                <dd className="text-lg font-semibold text-gray-900">One cart</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Tracking</dt>
                <dd className="text-lg font-semibold text-gray-900">Live status</dd>
              </div>
            </dl>
          </div>

          <div className="relative hidden md:block">
            <div className="grid grid-cols-2 gap-4">
              {(featured.length ? featured.slice(0, 4) : Array.from({ length: 4 })).map((product, index) => (
                <div
                  key={product?.id || index}
                  className={`card overflow-hidden ${index % 2 === 1 ? "translate-y-6" : ""}`}
                >
                  {product ? (
                    <Link href={`/product/${product.id}`} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.image || "/placeholder-product.svg"}
                        alt={product.name}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src = "/placeholder-product.svg";
                        }}
                      />
                      <p className="truncate px-3 py-2 text-xs text-gray-600">{product.name}</p>
                    </Link>
                  ) : (
                    <div className="aspect-square w-full animate-pulse bg-gray-100" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Shop by category</h2>
              <p className="text-sm text-gray-500">Find what you need across every store.</p>
            </div>
            <Link href="/categories" className="shrink-0 text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                className="card flex flex-col items-center gap-2 p-4 text-center transition-shadow hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-primary" aria-hidden="true">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-gray-900">{category.name}</span>
                <span className="text-xs text-gray-500">{category._count?.products ?? 0} products</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">New arrivals</h2>
            <p className="text-sm text-gray-500">The latest products added by our sellers.</p>
          </div>
          <Link href="/products?sortBy=newest" className="shrink-0 text-sm font-medium text-primary hover:underline">
            See all
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="card overflow-hidden">
                <div className="aspect-square w-full animate-pulse bg-gray-100" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : featured.length === 0 ? (
          <EmptyState
            title="No products yet"
            message="Once a seller adds products they will appear here. Run `node prisma/seed.js` to load the demo catalogue."
            action={
              <Link href="/products" className="btn-primary">
                Browse all products
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Top rated */}
      {topRated.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-900">Top rated by shoppers</h2>
              <p className="text-sm text-gray-500">Products with the best customer reviews.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {topRated.map((product) => (
                <ProductCard key={product.id} product={product} compact />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
