import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { listHolidays } from "@/server/services/business-hours";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { HolidayManager } from "@/components/admin/holiday-manager";

export const metadata = { title: "Holidays · Admin" };

export default async function AdminHolidaysPage() {
  const holidays = await listHolidays();

  return (
    <div>
      <AdminPageHeader
        eyebrow="Studio"
        title="Holidays & closures"
        description="One-off dates the studio is closed: festivals, staff leave, renovations. Blocked dates are hidden from the booking calendar."
        actions={
          <Link href="/admin/business-hours" className="btn-outline btn-sm">
            <CalendarDays size={15} /> Weekly hours
          </Link>
        }
      />

      <HolidayManager
        holidays={holidays.map((holiday) => ({
          id: holiday.id,
          name: holiday.name,
          description: holiday.description,
          date: holiday.date,
          isActive: holiday.isActive,
        }))}
      />
    </div>
  );
}
