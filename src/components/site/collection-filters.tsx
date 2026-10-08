"use client";

/**
 * URL-driven collection filters shared by the services, gallery and video
 * pages. Filtering happens on the server (see the pages), so the state lives in
 * the query string — which also makes filtered views shareable and indexable.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; count?: number };

export type FilterConfig = {
  key: string;
  label: string;
  options: FilterOption[];
  /** "chips" renders pills, "select" renders a dropdown (better on mobile). */
  variant?: "chips" | "select";
};

export function CollectionFilters({
  basePath,
  filters,
  sortOptions,
  searchPlaceholder,
  current,
}: {
  basePath: string;
  filters: FilterConfig[];
  sortOptions: FilterOption[];
  searchPlaceholder?: string;
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // Any filter change resets pagination.
      next.delete("page");
      const query = next.toString();
      startTransition(() => router.push(query ? `${basePath}?${query}` : basePath));
    },
    [basePath, params, router]
  );

  const activeCount =
    filters.filter((filter) => Boolean(current[filter.key])).length + (current.q ? 1 : 0) + (current.sort ? 1 : 0);

  return (
    <div className={cn("space-y-4", pending && "opacity-70 transition-opacity")} aria-busy={pending}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {searchPlaceholder ? (
          <form
            className="relative w-full sm:max-w-sm"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get("q");
              update({ q: String(value ?? "").trim() || undefined });
            }}
          >
            <label htmlFor="collection-search" className="sr-only">
              Search
            </label>
            <input
              id="collection-search"
              name="q"
              defaultValue={current.q ?? ""}
              placeholder={searchPlaceholder}
              className="input rounded-full pr-20"
            />
            <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-rose btn-sm">
              Search
            </button>
          </form>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-3">
          {sortOptions.length ? (
            <label className="flex items-center gap-2 text-xs text-muted">
              <span className="hidden sm:inline">Sort</span>
              <select
                className="select w-auto rounded-full py-2 text-sm"
                value={current.sort ?? sortOptions[0].value}
                onChange={(event) => update({ sort: event.target.value })}
                aria-label="Sort results"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {activeCount > 0 ? (
            <button
              type="button"
              className="btn-ghost btn-sm text-muted"
              onClick={() => startTransition(() => router.push(basePath))}
            >
              <X size={14} /> Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted">
          <SlidersHorizontal size={13} /> Filters
        </span>

        {filters.map((filter) =>
          filter.variant === "select" || filter.options.length > 6 ? (
            <label key={filter.key} className="flex items-center gap-2 text-xs text-muted">
              <span className="sr-only sm:not-sr-only">{filter.label}</span>
              <select
                className="select w-auto rounded-full py-1.5 text-xs"
                value={current[filter.key] ?? ""}
                onChange={(event) => update({ [filter.key]: event.target.value || undefined })}
                aria-label={filter.label}
              >
                <option value="">All {filter.label.toLowerCase()}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {typeof option.count === "number" ? ` (${option.count})` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div key={filter.key} className="flex flex-wrap items-center gap-1.5">
              <span className="sr-only">{filter.label}</span>
              <button
                type="button"
                onClick={() => update({ [filter.key]: undefined })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  !current[filter.key]
                    ? "border-rosegold bg-blush text-rosegold-dark"
                    : "border-line bg-white text-charcoal-soft hover:border-rosegold-soft"
                )}
              >
                All
              </button>
              {filter.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update({ [filter.key]: option.value })}
                  aria-pressed={current[filter.key] === option.value}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    current[filter.key] === option.value
                      ? "border-rosegold bg-blush text-rosegold-dark"
                      : "border-line bg-white text-charcoal-soft hover:border-rosegold-soft"
                  )}
                >
                  {option.label}
                  {typeof option.count === "number" ? <span className="ml-1 text-muted">{option.count}</span> : null}
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
