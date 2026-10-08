"use client";

/** Header/site search with live suggestions from /api/search. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Suggestion = {
  type: "service" | "gallery" | "video";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  image: string | null;
};

export function SearchBar({
  initialQuery = "",
  autoFocus = false,
  className,
  placeholder = "Search nail art, services and videos…",
}: {
  initialQuery?: string;
  autoFocus?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim();
  const showSuggestions = open && trimmedQuery.length >= 2;

  // Debounced suggestion lookup. The short-query case is handled while
  // rendering (`showSuggestions`), so the effect never sets state synchronously.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const payload = await response.json();
        if (payload.ok) setResults(payload.results as Suggestion[]);
      } catch {
        /* aborted or offline — suggestions are a nicety, not a requirement */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form onSubmit={submit} role="search" className="relative">
        <label htmlFor="site-search" className="sr-only">
          Search
        </label>
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="site-search"
          type="search"
          value={query}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="input rounded-full pl-11 pr-11"
          autoComplete="off"
        />
        {trimmedQuery ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-charcoal"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        ) : null}
      </form>

      {showSuggestions ? (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
          {loading ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Searching…
            </p>
          ) : results.length ? (
            <ul>
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <Link
                    href={result.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-cream"
                  >
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-nude">
                      {result.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={result.image} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{result.title}</span>
                      <span className="block text-xs text-muted">
                        {result.type === "service" ? "Service" : result.type === "gallery" ? "Gallery" : "Video"} ·{" "}
                        {result.subtitle}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              <li className="border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-rosegold-dark transition hover:bg-cream"
                >
                  See all results for “{query.trim()}”
                </button>
              </li>
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted">No matches yet — try a style, occasion or service name.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
