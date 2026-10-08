import Link from "next/link";
import { CalendarOff, Info } from "lucide-react";
import { getBusinessHours } from "@/server/services/business-hours";
import { minutesToTimeString } from "@/lib/validation";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { HoursForm } from "@/components/admin/hours-form";
import { Alert } from "@/components/ui/primitives";

export const metadata = { title: "Business hours · Admin" };

export default async function AdminBusinessHoursPage() {
  const hours = await getBusinessHours();

  const days = hours.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    dayName: day.dayName,
    isOpen: day.isOpen,
    openTime: minutesToTimeString(day.openMinutes),
    closeTime: minutesToTimeString(day.closeMinutes),
    breakStartTime: day.breakStartMinutes !== null ? minutesToTimeString(day.breakStartMinutes) : "",
    breakEndTime: day.breakEndMinutes !== null ? minutesToTimeString(day.breakEndMinutes) : "",
    slotIntervalMinutes: day.slotIntervalMinutes !== null ? String(day.slotIntervalMinutes) : "",
    note: day.note ?? "",
  }));

  return (
    <div>
      <AdminPageHeader
        eyebrow="Studio"
        title="Business hours"
        description="The booking engine builds every slot from these windows — closed days offer no appointments at all."
        actions={
          <Link href="/admin/holidays" className="btn-outline btn-sm">
            <CalendarOff size={15} /> Holidays & closures
          </Link>
        }
      />

      <div className="mb-6">
        <Alert tone="info" title="How this is used">
          <span className="inline-flex items-start gap-2">
            <Info size={15} className="mt-0.5 shrink-0" />
            A booking must fit completely inside opening hours, avoid any break, respect the minimum lead time, and not
            overlap another pending or confirmed appointment.
          </span>
        </Alert>
      </div>

      <HoursForm days={days} />
    </div>
  );
}
