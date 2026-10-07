"use client";

/**
 * Reusable product card for the home page, product grid and related-products
 * strip.
 *
 * Replaces the inline markup the products grid used, which had two bugs worth
 * calling out:
 *   - `Array.isArray(product.images)` was always false because the API returned
 *     `images` as a JSON *string*; every card fell back to the placeholder.
 *     The API now serialises images into a real array (see utils/serialize.js),
 *     and this component also tolerates the raw string as a safety net.
 *   - The "Add to Cart" button fired
 *     `alert("Add to cart functionality coming soon")`. It now calls the real
 *     /api/cart endpoint through useShopActions().
 */
import Link from "next/link";
import { formatCurrency, parseJsonArray, productImages } from "@/utils/format";
import { RatingStars } from "@/components/ui";
import { useShopActions } from "@/lib/useShopActions";

function resolveImage(product) {
  const direct = product?.image;
  if (typeof direct === "string" && direct.trim()) return direct;

  const fromArray = productImages(product?.images);
  if (fromArray.length) return fromArray[0];

  const parsed = parseJsonArray(product?.images, []);
  if (parsed.length && typeof parsed[0] === "string") return parsed[0];

  return "/placeholder-product.svg";
}

export default function ProductCard({ product, compact = false }) {
  const { addToCart, toggleWishlist, isPending, isSaved } = useShopActions();

  if (!product) return null;

  const image = resolveImage(product);
  const price = Number(product.price) || 0;
  const unitPrice = product.unitPrice !== undefined ? Number(product.unitPrice) : price;
  const discount = Number(product.discount) || 0;
  const onSale = discount > 0 && unitPrice < price;
  const stock = Number(product.stock) || 0;
  const inStock = product.inStock !== undefined ? Boolean(product.inStock) : stock > 0 && product.status !== "INACTIVE";

  const pending = isPending(product.id);
  const saved = isSaved(product.id);

  return (
    <article className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/product/${product.id}`} className="block aspect-square w-full overflow-hidden bg-gray-100">
        {/* Plain <img> is intentional: merchant-supplied image URLs are
            arbitrary and the SVG placeholders must not go through the
            optimiser. This matches the original markup. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.src = "/placeholder-product.svg";
          }}
        />
      </Link>

      {/* Wishlist toggle */}
      <button
        type="button"
        onClick={() => toggleWishlist(product.id)}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        className={`absolute right-2 top-2 rounded-full bg-white/90 p-2 shadow transition-colors hover:bg-white disabled:opacity-50 ${
          saved ? "text-danger" : "text-gray-500"
        }`}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {!inStock && (
        <span className="absolute left-2 top-2 badge bg-gray-900/80 text-white">Out of stock</span>
      )}
      {inStock && onSale && (
        <span className="absolute left-2 top-2 badge bg-danger text-white">-{discount}%</span>
      )}

      <div className="flex flex-1 flex-col p-4">
        {(product.categoryName || product.brandName) && (
          <p className="mb-1 truncate text-xs uppercase tracking-wide text-gray-400">
            {[product.brandName, product.categoryName].filter(Boolean).join(" · ")}
          </p>
        )}

        <h3 className="line-clamp-2 text-sm font-medium text-gray-900">
          <Link href={`/product/${product.id}`} className="hover:text-primary hover:underline">
            {product.name}
          </Link>
        </h3>

        {!compact && product.description && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{product.description}</p>
        )}

        <div className="mt-2">
          <RatingStars value={product.averageRating ?? product.rating ?? 0} count={product.reviewCount} showValue />
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">{formatCurrency(unitPrice)}</span>
          {onSale && <span className="text-sm text-gray-400 line-through">{formatCurrency(price)}</span>}
        </div>

        {product.sellerName && <p className="mt-1 truncate text-xs text-gray-500">Sold by {product.sellerName}</p>}

        <div className="mt-auto flex gap-2 pt-4">
          <Link href={`/product/${product.id}`} className="btn-outline flex-1 px-3 py-1.5 text-center">
            Details
          </Link>
          <button
            type="button"
            onClick={() => addToCart(product.id, 1)}
            disabled={!inStock || pending}
            className="btn-primary flex-1 px-3 py-1.5"
          >
            {pending ? "Adding..." : inStock ? "Add to cart" : "Unavailable"}
          </button>
        </div>
      </div>
    </article>
  );
}
