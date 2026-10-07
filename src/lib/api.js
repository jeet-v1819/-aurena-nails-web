/**
 * Tiny client-side fetch wrapper.
 *
 * Every API route in this project returns a predictable JSON envelope:
 *   success -> 2xx with the payload
 *   failure -> { error: string, details?: object }
 *
 * This helper turns a non-2xx response into a thrown Error carrying that
 * message plus `status` and `details`, so components can `try/catch` instead of
 * hand-checking `res.ok` and re-parsing JSON in every call site.
 */

export class ApiClientError extends Error {
  constructor(message, { status, details, payload } = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
    this.payload = payload;
  }
}

async function request(path, { method = "GET", body, headers, signal, query } = {}) {
  let url = path;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    });
    const qs = params.toString();
    if (qs) url += `${path.includes("?") ? "&" : "?"}${qs}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      // Never serve a stale authenticated payload from the browser cache.
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (error) {
    // Network failure / aborted request.
    if (error?.name === "AbortError") throw error;
    throw new ApiClientError("Network error — please check your connection and try again.", { status: 0 });
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 300) };
    }
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      (response.status === 401
        ? "You need to sign in to do that."
        : response.status === 403
          ? "You do not have permission to do that."
          : response.status === 404
            ? "Not found."
            : `Request failed (${response.status}).`);

    throw new ApiClientError(message, { status: response.status, details: payload?.details, payload });
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  del: (path, options) => request(path, { ...options, method: "DELETE" }),
};

export default api;
