/**
 * Small presentational building blocks shared by the public site and the admin
 * panel. Everything here is a pure function of its props (no hooks), so it can
 * render on the server.
 */
import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------- headings */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
      <Tag className="text-3xl md:text-4xl">{title}</Tag>
      {description ? <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">{description}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- badges */

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "rose" | "gold" | "muted" | "success" | "danger" | "warning";
  className?: string;
}) {
  const tones: Record<string, string> = {
    rose: "badge-rose",
    gold: "badge-gold",
    muted: "badge-muted",
    success: "badge-success",
    danger: "badge-danger",
    warning: "badge-warning",
  };
  return <span className={cn("badge", tones[tone], className)}>{children}</span>;
}

export function StatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  const tones: Record<string, "rose" | "gold" | "muted" | "success" | "danger" | "warning"> = {
    PENDING: "warning",
    CONFIRMED: "success",
    COMPLETED: "rose",
    CANCELLED: "muted",
    REJECTED: "danger",
  };
  return (
    <Badge tone={tones[status] ?? "muted"} className={className}>
      {label}
    </Badge>
  );
}

/* ----------------------------------------------------------------- rating */

export function StarRating({
  value,
  count,
  size = 14,
  showValue = true,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label={`Rated ${value} out of 5`}>
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            width={size}
            height={size}
            className={cn(
              "shrink-0",
              star <= rounded ? "fill-gold text-gold" : star - 0.5 === rounded ? "fill-gold/50 text-gold" : "text-nude-dark"
            )}
          />
        ))}
      </span>
      {showValue ? (
        <span className="text-xs text-muted">
          {value > 0 ? value.toFixed(1) : "New"}
          {typeof count === "number" && count > 0 ? ` (${count})` : ""}
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ states */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Skeleton className="h-56 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card-soft flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-rosegold">{icon}</div> : null}
      <h3 className="text-xl">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? (
        <Link href={action.href} className="btn-primary mt-6">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "danger" | "warning";
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-line bg-cream-deep text-charcoal-soft",
    success: "border-success/30 bg-success/5 text-success",
    danger: "border-danger/30 bg-danger/5 text-danger",
    warning: "border-warning/30 bg-warning/5 text-warning",
  } as const;

  return (
    <div role="status" className={cn("rounded-2xl border px-4 py-3 text-sm", tones[tone])}>
      {title ? <p className="mb-1 font-medium">{title}</p> : null}
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- pagination */

export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const buildHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    else params.delete("page");
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (candidate) => candidate === 1 || candidate === totalPages || Math.abs(candidate - page) <= 1
  );

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn("btn-outline btn-sm", page === 1 && "pointer-events-none opacity-50")}
      >
        Previous
      </Link>

      {pages.map((candidate, index) => (
        <span key={candidate} className="flex items-center gap-1.5">
          {index > 0 && candidate - pages[index - 1] > 1 ? <span className="px-1 text-muted">…</span> : null}
          <Link
            href={buildHref(candidate)}
            aria-current={candidate === page ? "page" : undefined}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm transition",
              candidate === page ? "bg-rosegold text-white" : "text-charcoal-soft hover:bg-cream-deep"
            )}
          >
            {candidate}
          </Link>
        </span>
      ))}

      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={cn("btn-outline btn-sm", page === totalPages && "pointer-events-none opacity-50")}
      >
        Next
      </Link>
    </nav>
  );
}

/* ------------------------------------------------------------------ misc */

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} aria-hidden="true" />;
}

export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-white/70 px-4 py-3">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}
