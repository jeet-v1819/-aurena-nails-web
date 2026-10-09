/** Accept only a same-origin absolute path for post-action redirects. */
export function safeInternalRedirectTarget(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback;
  const target = value.trim();
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return fallback;

  try {
    const base = new URL("https://internal.invalid");
    const resolved = new URL(target, base);
    if (resolved.origin !== base.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
