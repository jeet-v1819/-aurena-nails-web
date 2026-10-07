/**
 * /api/addresses
 *
 * Saved shipping/billing addresses for the signed-in user (the `Address` model
 * required by the schema spec, which had no API before).
 *
 * GET    — list own addresses.
 * POST   — create one. body: {fullName,line1,line2?,city,state,postalCode,country?,phone?,type?,label?,isDefault?}
 * PUT    — update one of your own. body: { id, ...fields }
 * DELETE — delete one of your own. ?id=...
 *
 * Every operation is scoped to the session user, so one customer can never
 * read or modify another customer's address book.
 */
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed, ApiError } from "@/lib/apiError";
import { requireAuth } from "@/lib/auth";
import { ADDRESS_TYPES } from "@/lib/constants";

function parseAddress(body, { partial = false } = {}) {
  const data = {};
  const has = (key) => body[key] !== undefined;

  if (has("fullName")) data.fullName = String(body.fullName || "").trim();
  if (has("phone")) data.phone = body.phone ? String(body.phone).trim() : null;
  if (has("line1")) data.line1 = String(body.line1 || "").trim();
  if (has("line2")) data.line2 = body.line2 ? String(body.line2).trim() : null;
  if (has("city")) data.city = String(body.city || "").trim();
  if (has("state")) data.state = String(body.state || "").trim();
  if (has("postalCode")) data.postalCode = String(body.postalCode || "").trim();
  if (has("country")) data.country = String(body.country || "India").trim();
  if (has("label")) data.label = body.label ? String(body.label).trim() : null;
  if (has("type")) {
    const type = String(body.type || "SHIPPING").toUpperCase();
    if (!ADDRESS_TYPES.includes(type)) throw ApiError.badRequest(`Address type must be one of: ${ADDRESS_TYPES.join(", ")}.`);
    data.type = type;
  }
  if (has("isDefault")) data.isDefault = Boolean(body.isDefault);

  if (!partial) {
    const required = ["fullName", "line1", "city", "state", "postalCode"];
    const missing = required.filter((field) => !data[field]);
    if (missing.length) {
      throw ApiError.unprocessable("Please complete the required address fields.", {
        missing,
      });
    }
  }

  return data;
}

/** Keep exactly one default address per user. */
async function applyDefaultFlag(userId, addressId, isDefault) {
  if (!isDefault) return;
  await prisma.address.updateMany({
    where: { userId, id: { not: addressId } },
    data: { isDefault: false },
  });
}

export default async function handler(req, res) {
  try {
    const user = await requireAuth(req, res);

    if (req.method === "GET") {
      const addresses = await prisma.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });
      return res.status(200).json({ addresses });
    }

    if (req.method === "POST") {
      const data = parseAddress(req.body || {});
      data.userId = user.id;

      const isFirst = (await prisma.address.count({ where: { userId: user.id } })) === 0;
      if (isFirst) data.isDefault = true;

      const address = await prisma.address.create({ data });
      await applyDefaultFlag(user.id, address.id, address.isDefault);

      return res.status(201).json({ address, message: "Address saved." });
    }

    if (req.method === "PUT") {
      const id = String(req.body?.id || req.query?.id || "");
      if (!id) throw ApiError.badRequest("An address id is required.");

      // Ownership check BEFORE the update.
      const existing = await prisma.address.findFirst({ where: { id, userId: user.id } });
      if (!existing) throw ApiError.notFound("Address not found.");

      const data = parseAddress(req.body || {}, { partial: true });
      const address = await prisma.address.update({ where: { id }, data });
      await applyDefaultFlag(user.id, address.id, address.isDefault);

      return res.status(200).json({ address, message: "Address updated." });
    }

    if (req.method === "DELETE") {
      const id = String(req.query?.id || req.body?.id || "");
      if (!id) throw ApiError.badRequest("An address id is required.");

      const existing = await prisma.address.findFirst({ where: { id, userId: user.id } });
      if (!existing) throw ApiError.notFound("Address not found.");

      await prisma.address.delete({ where: { id } });
      return res.status(200).json({ message: "Address deleted.", id });
    }

    return methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  } catch (error) {
    return respondWithError(res, error, "Address operation failed.");
  }
}
