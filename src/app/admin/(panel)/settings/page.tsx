import { getSiteContent } from "@/server/services/content";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { SettingsForm } from "@/components/admin/settings-form";
import {
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_CANCELLATION_WINDOW_HOURS,
  DEFAULT_MAX_ADVANCE_DAYS,
  DEFAULT_MIN_LEAD_MINUTES,
  DEFAULT_SLOT_INTERVAL_MINUTES,
} from "@/lib/constants";

export const metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  const content = await getSiteContent();

  return (
    <div>
      <AdminPageHeader
        eyebrow="Studio"
        title="Settings"
        description="Identity and the rules the booking engine follows. Everything here is stored in the database, so changes take effect immediately."
      />

      <SettingsForm
        initial={{
          siteName: content.siteName,
          tagline: content.tagline,
          seoDescription: content.seoDescription,
          footerNote: content.footerNote,
          slotIntervalMinutes: content.text("booking.slotIntervalMinutes")
            ? Number(content.text("booking.slotIntervalMinutes"))
            : DEFAULT_SLOT_INTERVAL_MINUTES,
          minLeadMinutes: content.text("booking.minLeadMinutes")
            ? Number(content.text("booking.minLeadMinutes"))
            : DEFAULT_MIN_LEAD_MINUTES,
          maxAdvanceDays: content.text("booking.maxAdvanceDays")
            ? Number(content.text("booking.maxAdvanceDays"))
            : DEFAULT_MAX_ADVANCE_DAYS,
          cancellationWindowHours: content.text("booking.cancellationWindowHours")
            ? Number(content.text("booking.cancellationWindowHours"))
            : DEFAULT_CANCELLATION_WINDOW_HOURS,
          bufferMinutes: content.text("booking.bufferMinutes")
            ? Number(content.text("booking.bufferMinutes"))
            : DEFAULT_BUFFER_MINUTES,
        }}
      />
    </div>
  );
}
