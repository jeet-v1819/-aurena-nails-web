"use client";

/**
 * Headline metric tile used across both dashboards.
 */
import Link from "next/link";
import { DeltaBadge } from "@/components/ui";

const TONES = {
  primary: "bg-green-50 text-primary",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
  red: "bg-red-50 text-danger",
  gray: "bg-gray-100 text-gray-600",
};

export default function StatCard({ label, value, hint, delta, icon, tone = "primary", href }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value ?? "—"}</p>
        </div>
        {icon && (
          <span className={`shrink-0 rounded-lg p-2 ${TONES[tone] || TONES.primary}`} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      {(hint || delta !== undefined) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {hint ? <p className="truncate text-xs text-gray-500">{hint}</p> : <span />}
          {delta !== undefined && <DeltaBadge value={delta} />}
        </div>
      )}
    </>
  );

  const className = "card block p-4 transition-shadow hover:shadow-md";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

/** Small grid wrapper so dashboards stay visually consistent. */
export function StatGrid({ children, columns = 4 }) {
  const spans = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
    6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  };
  return <div className={`grid grid-cols-1 gap-4 ${spans[columns] || spans[4]}`}>{children}</div>;
}

/** Commonly used dashboard icons, kept as inline SVG to avoid a dependency. */
export const icons = {
  money: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3v18m4-14H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cart: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.55L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5.2a3.2 3.2 0 0 1 0 5.6M18 20a6 6 0 0 0-2-4.5" strokeLinecap="round" />
    </svg>
  ),
  box: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  store: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9l1.5-4h13L20 9M9 20v-5h6v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 4 2.8 20h18.4zM12 10v4m0 3h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chart: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20V10m5 10V4m5 16v-7m5 7V8" strokeLinecap="round" />
    </svg>
  ),
};
