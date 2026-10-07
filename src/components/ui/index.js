"use client";

/**
 * Small shared UI primitives: spinner, empty state, error state, status badges,
 * star ratings and pagination.
 *
 * The README lists "Empty states, error states, loading states" and
 * "Validation messages" as features; these components provide them consistently
 * across the storefront and both dashboards.
 */
import Link from "next/link";

export function Spinner({ label = "Loading...", className = "h-5 w-5" }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-gray-500">
      <svg className={`animate-spin-slow ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{label}</span>
    </span>
  );
}

export function PageLoader({ label = "Loading..." }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label={label} className="h-6 w-6" />
    </div>
  );
}

export function EmptyState({ title, message, action, icon }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 text-gray-300">{icon}</div>
      ) : (
        <svg className="mb-4 h-12 w-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-gray-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="card border-red-200 bg-red-50 px-6 py-8 text-center">
      <h3 className="text-base font-semibold text-red-900">{title}</h3>
      {message && <p className="mt-1 text-sm text-red-700">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-primary mt-4">
          Try again
        </button>
      )}
    </div>
  );
}

/** Field-level validation message for forms. */
export function FieldError({ children }) {
  if (!children) return null;
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-danger" role="alert">
      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
      </svg>
      {children}
    </p>
  );
}

const ORDER_BADGE = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-violet-100 text-violet-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-gray-200 text-gray-800",
};

const PAYMENT_BADGE = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-gray-200 text-gray-800",
};

const PRODUCT_BADGE = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-200 text-gray-700",
  OUT_OF_STOCK: "bg-red-100 text-red-800",
};

const ROLE_BADGE = {
  ADMIN: "bg-purple-100 text-purple-800",
  SELLER: "bg-blue-100 text-blue-800",
  CUSTOMER: "bg-gray-100 text-gray-700",
};

const LABELS = {
  OUT_OF_STOCK: "Out of stock",
};

function Badge({ value, palette, className = "" }) {
  if (!value) return null;
  const key = String(value).toUpperCase();
  const tone = palette[key] || "bg-gray-100 text-gray-700";
  const label = key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, " ");
  return <span className={`badge ${tone} ${className}`}>{LABELS[key] || label}</span>;
}

export const OrderStatusBadge = (props) => <Badge {...props} palette={ORDER_BADGE} />;
export const PaymentStatusBadge = (props) => <Badge {...props} palette={PAYMENT_BADGE} />;
export const ProductStatusBadge = (props) => <Badge {...props} palette={PRODUCT_BADGE} />;
export const RoleBadge = (props) => <Badge {...props} palette={ROLE_BADGE} />;

export function DeltaBadge({ value }) {
  const delta = Number(value) || 0;
  const positive = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-green-700" : "text-danger"}`}>
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path d={positive ? "M12 19V5m0 0-6 6m6-6 6 6" : "M12 5v14m0 0 6-6m-6 6-6-6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {positive ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  );
}

export function RatingStars({ value = 0, count, size = "sm", showValue = false }) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const dimension = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = rating >= star - 0.25;
          const half = !filled && rating >= star - 0.75;
          return (
            <svg key={star} className={`${dimension} ${filled ? "text-amber-400" : half ? "text-amber-300" : "text-gray-300"}`} viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 1.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L10 15.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z" />
            </svg>
          );
        })}
      </span>
      <span className="sr-only">{`Rated ${rating.toFixed(1)} out of 5`}</span>
      {showValue && <span className="text-xs font-medium text-gray-700">{rating.toFixed(1)}</span>}
      {typeof count === "number" && <span className="text-xs text-gray-500">({count})</span>}
    </span>
  );
}

/**
 * Rating input for the review form — clickable stars backed by a radio group so
 * it stays keyboard accessible.
 */
export function RatingInput({ value, onChange, name = "rating" }) {
  return (
    <fieldset className="flex items-center gap-1">
      <legend className="sr-only">Your rating</legend>
      {[1, 2, 3, 4, 5].map((star) => (
        <label key={star} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={star}
            checked={Number(value) === star}
            onChange={() => onChange(star)}
            className="sr-only"
          />
          <svg
            className={`h-7 w-7 transition-colors ${Number(value) >= star ? "text-amber-400" : "text-gray-300 hover:text-amber-300"}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10 1.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L10 15.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z" />
          </svg>
          <span className="sr-only">{`${star} star${star > 1 ? "s" : ""}`}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Pagination({ page = 1, totalPages = 1, onChange, baseUrl, paramName = "page" }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const window = 1;
  for (let p = Math.max(1, page - window); p <= Math.min(totalPages, page + window); p += 1) pages.push(p);

  const hrefFor = (target) => {
    if (!baseUrl) return undefined;
    const url = new URL(baseUrl, "http://placeholder.local");
    url.searchParams.set(paramName, String(target));
    return `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams}` : ""}`;
  };

  const Step = ({ target, label, disabled, current }) => {
    const classes = `btn-outline px-3 py-1.5 ${disabled ? "pointer-events-none opacity-40" : ""} ${
      current ? "border-primary bg-primary text-white hover:bg-primary-dark hover:text-white" : ""
    }`;
    const href = hrefFor(target);
    return href && !disabled ? (
      <Link href={href} className={classes} aria-current={current ? "page" : undefined}>
        {label}
      </Link>
    ) : (
      <button type="button" onClick={() => !disabled && onChange?.(target)} className={classes} disabled={disabled} aria-current={current ? "page" : undefined}>
        {label}
      </button>
    );
  };

  return (
    <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
      <Step target={page - 1} label="Previous" disabled={page <= 1} />
      {pages[0] > 1 && <Step target={1} label="1" onChange={onChange} />}
      {pages[0] > 2 && <span className="px-1 text-gray-400">…</span>}
      {pages.map((target) => (
        <Step key={target} target={target} label={String(target)} current={target === page} onChange={onChange} />
      ))}
      {pages[pages.length - 1] < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}
      {pages[pages.length - 1] < totalPages && <Step target={totalPages} label={String(totalPages)} onChange={onChange} />}
      <Step target={page + 1} label="Next" disabled={page >= totalPages} />
    </nav>
  );
}
