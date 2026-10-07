/**
 * Typed API error so services can signal an appropriate HTTP status instead of
 * every route collapsing to a generic 500.
 */
export class ApiError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} message human-readable message safe to return to the client
   * @param {object} [details] optional extra payload (e.g. field errors)
   */
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  static badRequest(message = "Bad request", details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message);
  }
  static forbidden(message = "You do not have permission to perform this action") {
    return new ApiError(403, message);
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }
  static conflict(message = "Resource already exists") {
    return new ApiError(409, message);
  }
  static unprocessable(message = "Validation failed", details) {
    return new ApiError(422, message, details);
  }
}

/**
 * Translate a thrown error into a JSON response.
 * Prisma's known error codes are mapped to sensible HTTP statuses so database
 * problems are not exposed as opaque 500s (and P2002/P2025 are not mistaken for
 * server faults).
 */
export function respondWithError(res, error, fallbackMessage = "Internal server error") {
  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  // Services may throw a plain Error carrying a numeric `status`; honour it.
  if (typeof error?.status === "number" && error.status >= 400 && error.status <= 599) {
    return res.status(error.status).json({ error: error.message || fallbackMessage });
  }

  // Prisma Client known request errors carry a `code` like "P2002".
  const code = error?.code;
  if (typeof code === "string" && /^P\d{4}$/.test(code)) {
    if (code === "P2002") {
      const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(", ") : error?.meta?.target;
      return res.status(409).json({ error: `A record with this ${target || "value"} already exists.` });
    }
    if (code === "P2025") {
      return res.status(404).json({ error: "Record not found." });
    }
    if (code === "P2003") {
      return res.status(400).json({ error: "Related record does not exist." });
    }
    if (code === "P2012") {
      return res.status(400).json({ error: "A required value is missing." });
    }
    return res.status(400).json({ error: "Invalid database request.", code });
  }

  // Never leak internals to the client; keep them in the server log.
  // eslint-disable-next-line no-console
  console.error("[api]", error);
  return res.status(500).json({ error: fallbackMessage });
}

/** 405 with a correct Allow header. */
export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed);
  return res.status(405).json({ error: "Method not allowed", allowed });
}
