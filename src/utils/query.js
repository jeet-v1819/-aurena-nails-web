/**
 * Prisma query-building helpers that paper over SQLite vs PostgreSQL
 * differences, so the same service/API code runs on both engines.
 */
import { getDbProvider } from "@/lib/prisma";

/**
 * Prisma's `mode: "insensitive"` is only supported by PostgreSQL. Passing it to
 * the SQLite connector raises a validation error at query time
 * ("Unknown arg `mode`"), which is what previously broke every `search=` call.
 *
 * SQLite's LIKE is already case-insensitive for ASCII, so omitting `mode`
 * there gives the same practical behaviour.
 *
 * @param {string} value
 * @returns {object} a Prisma String filter fragment
 */
export function icontains(value) {
  const v = String(value ?? "");
  if (getDbProvider() === "postgresql") {
    return { contains: v, mode: "insensitive" };
  }
  return { contains: v };
}

/**
 * Build an OR'd search across several fields.
 * @param {string} term
 * @param {Array<string|{path:string[], field:string}>} fields
 *   e.g. ["name", "sku", { path: ["brand", "name"] }]
 */
export function searchOr(term, fields) {
  const value = String(term ?? "").trim();
  if (!value) return null;

  return fields.reduce((or, entry) => {
    if (typeof entry === "string") {
      if (entry) or.push({ [entry]: icontains(value) });
      return or;
    }

    // Nested relation filter, e.g. { path: ["brand", "name"] } ->
    //   { brand: { name: { contains: ... } } }
    //
    // BUG FIXED: this used to fold over `path.slice(1)` while ALSO seeding the
    // accumulator with the last key, so ["brand","name"] produced
    // `{ name: { name: {...} } }` — Prisma rejected it with
    // "Unknown argument `name`" and every `?search=` on products returned 500.
    const keys = Array.isArray(entry?.path) ? entry.path.filter(Boolean) : [];
    if (!keys.length) return or;

    const leaf = keys[keys.length - 1];
    or.push(keys.slice(0, -1).reduceRight((acc, key) => ({ [key]: acc }), { [leaf]: icontains(value) }));
    return or;
  }, []);
}

/**
 * Coerce a sort specification into a Prisma `orderBy`, refusing unknown fields.
 * Unknown fields would throw a Prisma validation error, so they are rejected
 * here and replaced with the default.
 *
 * @param {string} field
 * @param {string} direction
 * @param {string[]} allowed
 * @param {string} defaultField
 */
export function safeOrderBy(field, direction, allowed, defaultField = "createdAt") {
  const chosen = allowed.includes(field) ? field : defaultField;
  const dir = String(direction || "").toLowerCase() === "asc" ? "asc" : "desc";
  return { [chosen]: dir };
}

/** Coerce a numeric query-string param, or return undefined when absent. */
export function toNumberOrUndefined(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Coerce a boolean-ish query param ("true"/"active"/"1"). */
export function toBoolean(value) {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "").toLowerCase();
  return s === "true" || s === "1" || s === "active" || s === "enabled" || s === "yes";
}
