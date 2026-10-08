/**
 * Opening hours and holidays — the two inputs the booking engine trusts for
 * "when are we open?".
 */
import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { DAY_NAMES } from "@/lib/constants";
import { toDateOnly } from "@/lib/utils";
import { recordAudit } from "./audit";

export type BusinessHour = {
  id: string;
  dayOfWeek: number;
  dayName: string;
  isOpen: boolean;
  openMinutes: number;
  closeMinutes: number;
  breakStartMinutes: number | null;
  breakEndMinutes: number | null;
  slotIntervalMinutes: number | null;
  note: string | null;
};

const DEFAULT_HOURS: BusinessHour[] = DAY_NAMES.map((dayName, dayOfWeek) => ({
  id: `default-${dayOfWeek}`,
  dayOfWeek,
  dayName,
  isOpen: dayOfWeek !== 0, // Sunday closed by default
  openMinutes: 10 * 60,
  closeMinutes: dayOfWeek === 6 ? 20 * 60 : 19 * 60,
  breakStartMinutes: null,
  breakEndMinutes: null,
  slotIntervalMinutes: null,
  note: null,
}));

/** All seven days, always in Sunday→Saturday order. */
export const getBusinessHours = cache(async (): Promise<BusinessHour[]> => {
  try {
    const rows = await prisma.businessHours.findMany({ orderBy: { dayOfWeek: "asc" } });
    if (!rows.length) return DEFAULT_HOURS;

    const byDay = new Map(rows.map((row) => [row.dayOfWeek, row]));
    return DAY_NAMES.map((dayName, dayOfWeek) => {
      const row = byDay.get(dayOfWeek);
      if (!row) return DEFAULT_HOURS[dayOfWeek];
      return {
        id: row.id,
        dayOfWeek: row.dayOfWeek,
        dayName,
        isOpen: row.isOpen,
        openMinutes: row.openMinutes,
        closeMinutes: row.closeMinutes,
        breakStartMinutes: row.breakStartMinutes,
        breakEndMinutes: row.breakEndMinutes,
        slotIntervalMinutes: row.slotIntervalMinutes,
        note: row.note,
      };
    });
  } catch (error) {
    console.error("[business-hours] falling back to defaults:", error);
    return DEFAULT_HOURS;
  }
});

export async function getBusinessHoursForDay(dayOfWeek: number) {
  const hours = await getBusinessHours();
  return hours.find((day) => day.dayOfWeek === dayOfWeek) ?? DEFAULT_HOURS[dayOfWeek];
}

export async function updateBusinessHours(
  adminId: string,
  days: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openMinutes: number;
    closeMinutes: number;
    breakStartMinutes?: number;
    breakEndMinutes?: number;
    slotIntervalMinutes?: number;
    note?: string;
  }>
) {
  await prisma.$transaction(
    days.map((day) =>
      prisma.businessHours.upsert({
        where: { dayOfWeek: day.dayOfWeek },
        create: {
          dayOfWeek: day.dayOfWeek,
          isOpen: day.isOpen,
          openMinutes: day.openMinutes,
          closeMinutes: day.closeMinutes,
          breakStartMinutes: day.breakStartMinutes ?? null,
          breakEndMinutes: day.breakEndMinutes ?? null,
          slotIntervalMinutes: day.slotIntervalMinutes ?? null,
          note: day.note ?? null,
        },
        update: {
          isOpen: day.isOpen,
          openMinutes: day.openMinutes,
          closeMinutes: day.closeMinutes,
          breakStartMinutes: day.breakStartMinutes ?? null,
          breakEndMinutes: day.breakEndMinutes ?? null,
          slotIntervalMinutes: day.slotIntervalMinutes ?? null,
          note: day.note ?? null,
        },
      })
    )
  );

  await recordAudit({ actorId: adminId, action: "business-hours.update", entity: "BusinessHours", changes: { days } });
}

/* ------------------------------------------------------------------ holidays */

export async function listHolidays(options: { upcomingOnly?: boolean; activeOnly?: boolean } = {}) {
  return prisma.holiday.findMany({
    where: {
      ...(options.activeOnly ? { isActive: true } : {}),
      ...(options.upcomingOnly ? { date: { gte: toDateOnly(new Date()) } } : {}),
    },
    orderBy: { date: "asc" },
  });
}

export async function getHoliday(date: Date) {
  return prisma.holiday.findFirst({
    where: { date: toDateOnly(date), isActive: true },
    select: { id: true, name: true, description: true, date: true },
  });
}

export async function createHoliday(
  adminId: string,
  input: { name: string; date: Date; description?: string; isActive: boolean }
) {
  const holiday = await prisma.holiday.create({
    data: {
      name: input.name,
      date: toDateOnly(input.date),
      description: input.description ?? null,
      isActive: input.isActive,
    },
  });
  await recordAudit({ actorId: adminId, action: "holiday.create", entity: "Holiday", entityId: holiday.id });
  return holiday;
}

export async function updateHoliday(
  adminId: string,
  holidayId: string,
  input: { name: string; date: Date; description?: string; isActive: boolean }
) {
  const holiday = await prisma.holiday.update({
    where: { id: holidayId },
    data: {
      name: input.name,
      date: toDateOnly(input.date),
      description: input.description ?? null,
      isActive: input.isActive,
    },
  });
  await recordAudit({ actorId: adminId, action: "holiday.update", entity: "Holiday", entityId: holidayId, changes: input });
  return holiday;
}

export async function deleteHoliday(adminId: string, holidayId: string) {
  await prisma.holiday.delete({ where: { id: holidayId } });
  await recordAudit({ actorId: adminId, action: "holiday.delete", entity: "Holiday", entityId: holidayId });
}
