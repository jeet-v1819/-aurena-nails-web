/**
 * Availability endpoint used by the booking wizard's calendar.
 *
 *   GET /api/availability?serviceId=…&date=YYYY-MM-DD
 *   GET /api/availability?serviceId=…&from=YYYY-MM-DD&days=31
 *
 * Runs the same rules as the booking action, so the UI can never offer a slot
 * the server would reject.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { dateOnlyFromString } from "@/lib/time";
import { getAvailabilityRange } from "@/server/services/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const serviceId = params.get("serviceId");
    const dateParam = params.get("date");
    const fromParam = params.get("from");
    const days = Number(params.get("days") ?? 1);

    if (!serviceId) {
      return NextResponse.json({ ok: false, error: "A service must be selected." }, { status: 400 });
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, deletedAt: null, isActive: true, category: { type: "SERVICE" } },
      select: { id: true, name: true, durationMinutes: true, isAvailable: true },
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "That service is not available." }, { status: 404 });
    }

    if (!service.isAvailable) {
      return NextResponse.json(
        { ok: false, error: "That service is temporarily unavailable. Please choose another service." },
        { status: 409 }
      );
    }

    const from = dateParam || fromParam ? dateOnlyFromString(dateParam ?? fromParam ?? "") : null;
    if ((dateParam || fromParam) && !from) {
      return NextResponse.json({ ok: false, error: "Invalid date." }, { status: 400 });
    }

    const days$ = dateParam ? 1 : Math.min(Math.max(Number.isFinite(days) ? days : 31, 1), 120);

    const range = await getAvailabilityRange({
      durationMinutes: service.durationMinutes,
      fromDate: from ?? undefined,
      days: days$,
    });

    return NextResponse.json({
      ok: true,
      service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes },
      days: range,
    });
  } catch (error) {
    console.error("[api/availability] failed:", error);
    return NextResponse.json(
      { ok: false, error: "We could not load availability right now. Please try again." },
      { status: 500 }
    );
  }
}
