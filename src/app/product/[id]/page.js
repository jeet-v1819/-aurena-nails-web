"use client";

/**
 * Product detail page.
 *
 * This file previously contained ONLY a placeholder:
 *
 *   export default function ProductDetailPage() {
 *     return <div><h1>Product Detail</h1></div>;
 *   }
 *
 * — no data fetching, no `useParams`, no images, no add-to-cart, no reviews —
 * even though productService.getProductById(), the reviews helpers in
 * orderService and the /product/[id] route were all referenced elsewhere in the
 * project. The intended functionality has been restored from those existing
 * services and the README's feature list:
 *
 *   gallery, price/discount, stock, quantity selector, add to cart, wishlist,
 *   variant (size/colour) selection, specifications, seller info, reviews with
 *   a rating histogram and a submit form, and related products.
 *
 * Also fixes the malformed className template literal the original had around
 * the product image: class names are now built with a plain array join so the
 * expression can never produce `className="[object Object]"` or stray
 * backticks inside the JSX attribute.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Navigation from "@/components/navigation";
import ProductCard from "@/components/products/product-card";
import {
  EmptyState,
  ErrorState,
  FieldError,
  PageLoader,
  RatingInput,
  RatingStars,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useShopActions } from "@/lib/useShopActions";
import { useToast } from "@/components/providers";
import { formatCurrency, formatDate, parseJsonArray, parseJsonObject, productImages } from "@/utils/format";

/** Join class fragments, dropping falsy values — safe for dynamic className. */
const cx = (...parts) => parts.filter(Boolean).join(" ");

const PLACEHOLDER = "/placeholder-product.svg";

export default function ProductDetailPage() {
  const params = useParams();
  const productId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : null;

  const { data: session } = useSession();
  const { addToCart, toggleWishlist, isPending, isSaved } = useShopActions();
  const { success, error: toastError } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = useCallback(async () => {
    if (!productId) {
      setError("This product does not exist.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.get(`/api/products/${encodeURIComponent(productId)}`);
      setData(result);
      setActiveImage(0);
      setQuantity(1);

      const product = result.product;
      const sizes = parseJsonArray(product?.size, []);
      const colors = parseJsonArray(product?.color, []);
      setSelectedSize(sizes.length === 1 ? String(sizes[0]) : "");
      setSelectedColor(colors.length === 1 ? String(colors[0]) : "");
    } catch (err) {
      setError(err.status === 404 ? "We could not find that product." : err.message || "Could not load this product.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const product = data?.product || null;
  const reviews = data?.reviews || [];
  const distribution = data?.reviewDistribution || [];
  const related = data?.related || [];

  const images = useMemo(() => {
    const list = product ? productImages(product.images) : [];
    return list.length ? list : [PLACEHOLDER];
  }, [product]);

  const specifications = useMemo(() => parseJsonObject(product?.specifications, {}), [product]);
  const sizes = useMemo(() => parseJsonArray(product?.size, []), [product]);
  const colors = useMemo(() => parseJsonArray(product?.color, []), [product]);

  const price = Number(product?.price) || 0;
  const unitPrice = product?.unitPrice !== undefined ? Number(product.unitPrice) : price;
  const discount = Number(product?.discount) || 0;
  const onSale = discount > 0 && unitPrice < price;
  const stock = Number(product?.stock) || 0;
  const inStock = stock > 0 && product?.status !== "INACTIVE";
  const savedPercent = onSale && price > 0 ? Math.round(((price - unitPrice) / price) * 100) : 0;

  const canReview = Boolean(session?.user?.id);
  const myReview = reviews.find((review) => review.userId === session?.user?.id) || null;

  async function handleAddToCart() {
    if (sizes.length > 1 && !selectedSize) {
      toastError("Please choose a size first.");
      return;
    }
    if (colors.length > 1 && !selectedColor) {
      toastError("Please choose a colour first.");
      return;
    }
    await addToCart(product.id, quantity);
  }

  async function handleSubmitReview(event) {
    event.preventDefault();
    setReviewError("");

    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      setReviewError("Please select a star rating between 1 and 5.");
      return;
    }

    setSubmittingReview(true);
    try {
      await api.post("/api/reviews", {
        productId: product.id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      success("Thank you — your review has been saved.", { title: "Review submitted" });
      setReviewComment("");
      // Re-fetch so the histogram and average update immediately.
      await load();
    } catch (err) {
      setReviewError(err.message || "Could not save your review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navigation />
        <PageLoader label="Loading product..." />
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Navigation />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <ErrorState title="Product unavailable" message={error} onRetry={load} />
          <div className="mt-6 text-center">
            <Link href="/products" className="btn-outline">
              Back to all products
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <li>
              <Link href="/" className="hover:text-primary hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/products" className="hover:text-primary hover:underline">
                Products
              </Link>
            </li>
            {product.category?.slug && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/products?category=${encodeURIComponent(product.category.slug)}`} className="hover:text-primary hover:underline">
                    {product.category.name}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true">/</li>
            <li className="truncate text-gray-700" aria-current="page">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* ---------------- Gallery ---------------- */}
          <div>
            <div className="card overflow-hidden">
              <div className="relative aspect-square w-full bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[Math.min(activeImage, images.length - 1)] || PLACEHOLDER}
                  alt={`${product.name} — image ${activeImage + 1} of ${images.length}`}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.src = PLACEHOLDER;
                  }}
                />

                {onSale && (
                  <span className="absolute left-3 top-3 badge bg-danger text-white">Save {savedPercent}%</span>
                )}
                {!inStock && (
                  <span className="absolute left-3 top-3 badge bg-gray-900/85 text-white">Out of stock</span>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {images.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Show image ${index + 1}`}
                    aria-current={index === activeImage}
                    className={cx(
                      "h-20 w-20 overflow-hidden rounded-md border-2 bg-gray-100 transition-colors",
                      index === activeImage ? "border-primary" : "border-transparent hover:border-gray-300"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---------------- Buy box ---------------- */}
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {product.brand?.name && (
                <Link href={`/products?brand=${encodeURIComponent(product.brand.slug)}`} className="badge bg-gray-100 text-gray-700 hover:bg-gray-200">
                  {product.brand.name}
                </Link>
              )}
              {product.category?.name && (
                <Link href={`/products?category=${encodeURIComponent(product.category.slug)}`} className="badge bg-gray-100 text-gray-700 hover:bg-gray-200">
                  {product.category.name}
                </Link>
              )}
              {product.sku && <span className="text-gray-400">SKU {product.sku}</span>}
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{product.name}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <RatingStars value={product.averageRating} count={product.reviewCount} size="lg" showValue />
              <a href="#reviews" className="text-sm text-primary hover:underline">
                {product.reviewCount || 0} review{(product.reviewCount || 0) === 1 ? "" : "s"}
              </a>
              <span className="text-xs text-gray-400">{product.views || 0} views</span>
            </div>

            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">{formatCurrency(unitPrice)}</span>
              {onSale && (
                <>
                  <span className="text-lg text-gray-400 line-through">{formatCurrency(price)}</span>
                  <span className="badge bg-red-100 text-danger">-{discount}%</span>
                </>
              )}
            </div>

            <p className="mt-2 text-sm" aria-live="polite">
              {inStock ? (
                stock <= 5 ? (
                  <span className="font-medium text-amber-700">Only {stock} left in stock</span>
                ) : (
                  <span className="font-medium text-green-700">In stock — {stock} available</span>
                )
              ) : (
                <span className="font-medium text-danger">Currently unavailable</span>
              )}
            </p>

            {product.description && <p className="mt-5 text-sm leading-relaxed text-gray-600">{product.description}</p>}

            {/* Variants */}
            {sizes.length > 0 && (
              <fieldset className="mt-6">
                <legend className="label">
                  Size {sizes.length > 1 && !selectedSize && <span className="text-danger">*</span>}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={String(size)}
                      type="button"
                      onClick={() => setSelectedSize(String(size))}
                      aria-pressed={selectedSize === String(size)}
                      className={cx(
                        "min-w-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                        selectedSize === String(size)
                          ? "border-primary bg-primary text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary"
                      )}
                    >
                      {String(size)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {colors.length > 0 && (
              <fieldset className="mt-5">
                <legend className="label">
                  Colour {colors.length > 1 && !selectedColor && <span className="text-danger">*</span>}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={String(color)}
                      type="button"
                      onClick={() => setSelectedColor(String(color))}
                      aria-pressed={selectedColor === String(color)}
                      className={cx(
                        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                        selectedColor === String(color)
                          ? "border-primary bg-primary text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary"
                      )}
                    >
                      {String(color)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Quantity + actions */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-md border border-gray-300 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="px-3 py-2 text-gray-600 transition-colors hover:text-primary disabled:opacity-40"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, stock)}
                  value={quantity}
                  onChange={(event) => {
                    const next = Number.parseInt(event.target.value, 10);
                    setQuantity(Number.isFinite(next) ? Math.min(Math.max(1, next), Math.max(1, stock)) : 1);
                  }}
                  aria-label="Quantity"
                  className="w-14 border-x border-gray-300 py-2 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.min(Math.max(1, stock), current + 1))}
                  disabled={quantity >= stock}
                  aria-label="Increase quantity"
                  className="px-3 py-2 text-gray-600 transition-colors hover:text-primary disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <button type="button" onClick={handleAddToCart} disabled={!inStock || isPending(product.id)} className="btn-primary flex-1 px-6 py-2.5 sm:flex-none">
                {isPending(product.id) ? "Adding..." : inStock ? "Add to cart" : "Unavailable"}
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                disabled={isPending(product.id)}
                aria-pressed={isSaved(product.id)}
                className={cx("btn-outline px-4 py-2.5", isSaved(product.id) && "border-danger text-danger hover:border-danger hover:text-danger")}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill={isSaved(product.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {isSaved(product.id) ? "Saved" : "Save"}
              </button>
            </div>

            {/* Seller */}
            <div className="card mt-7 flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-gray-500">Sold by</p>
                <p className="truncate text-sm font-semibold text-gray-900">{product.seller?.name || "E-Shop"}</p>
                {product.seller?.createdAt && (
                  <p className="text-xs text-gray-500">Selling since {formatDate(product.seller.createdAt, { dateStyle: "medium" })}</p>
                )}
              </div>
              <Link href={`/products?sellerId=${encodeURIComponent(product.sellerId || "")}`} className="btn-outline shrink-0 px-3 py-1.5">
                View store
              </Link>
            </div>

            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Checkout uses a simulated payment flow — no real payment gateway is configured in this project.
            </p>
          </div>
        </div>

        {/* ---------------- Specifications ---------------- */}
        {Object.keys(specifications).length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold text-gray-900">Specifications</h2>
            <dl className="card mt-3 divide-y divide-gray-100">
              {Object.entries(specifications).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-3 px-4 py-3 text-sm">
                  <dt className="font-medium capitalize text-gray-500">{key.replace(/([A-Z])/g, " $1").trim()}</dt>
                  <dd className="col-span-2 text-gray-900">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* ---------------- Reviews ---------------- */}
        <section id="reviews" className="mt-12 scroll-mt-20">
          <h2 className="text-lg font-bold text-gray-900">Customer reviews</h2>

          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            {/* Summary */}
            <div className="card p-5">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-900">{Number(product.averageRating || 0).toFixed(1)}</span>
                <span className="text-sm text-gray-500">out of 5</span>
              </div>
              <div className="mt-2">
                <RatingStars value={product.averageRating} count={product.reviewCount} size="lg" />
              </div>

              <ul className="mt-4 space-y-1.5">
                {distribution.map((row) => {
                  const pct = product.reviewCount > 0 ? Math.round((row.count / product.reviewCount) * 100) : 0;
                  return (
                    <li key={row.rating} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-8 shrink-0">{row.rating}★</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-6 shrink-0 text-right">{row.count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* List + form */}
            <div className="lg:col-span-2">
              {canReview ? (
                <form onSubmit={handleSubmitReview} className="card mb-5 p-5">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {myReview ? "Update your review" : "Write a review"}
                  </h3>

                  <div className="mt-3">
                    <RatingInput value={reviewRating || myReview?.rating || 0} onChange={setReviewRating} />
                  </div>
                  <FieldError>{reviewError}</FieldError>

                  <label htmlFor="review-comment" className="label mt-4">
                    Your review <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    id="review-comment"
                    rows={3}
                    maxLength={2000}
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="What did you like or dislike about this product?"
                    className="input resize-y"
                  />

                  <div className="mt-3 flex items-center gap-3">
                    <button type="submit" disabled={submittingReview} className="btn-primary">
                      {submittingReview ? "Saving..." : myReview ? "Update review" : "Submit review"}
                    </button>
                    <span className="text-xs text-gray-500">One review per product — resubmitting updates it.</span>
                  </div>
                </form>
              ) : (
                <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
                  <p className="text-sm text-gray-600">Sign in to write a review for this product.</p>
                  <Link href={`/login?callbackUrl=${encodeURIComponent(`/product/${product.id}`)}`} className="btn-outline">
                    Sign in
                  </Link>
                </div>
              )}

              {reviews.length === 0 ? (
                <EmptyState
                  title="No reviews yet"
                  message="Be the first to share your experience with this product."
                />
              ) : (
                <ul className="space-y-4">
                  {reviews.map((review) => (
                    <li key={review.id} className="card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{review.authorName || review.user?.name || "Anonymous"}</p>
                          <div className="mt-1">
                            <RatingStars value={review.rating} />
                          </div>
                        </div>
                        <time className="text-xs text-gray-400" dateTime={review.createdAt}>
                          {formatDate(review.createdAt, { dateStyle: "medium" })}
                        </time>
                      </div>
                      {review.comment && <p className="mt-3 text-sm leading-relaxed text-gray-600">{review.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ---------------- Related ---------------- */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Related products</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} compact />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
