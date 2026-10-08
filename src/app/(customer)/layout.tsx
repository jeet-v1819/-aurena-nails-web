import Link from "next/link";
import { CalendarCheck, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { unreadNotificationCount } from "@/server/services/notifications";
import { getBusinessHours } from "@/server/services/business-hours";
import { getSiteContent } from "@/server/services/content";
import { AccountNav } from "@/components/customer/account-nav";
import { formatMinutes } from "@/lib/format";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  // Server-side guard: the proxy already redirects, this is the authoritative check.
  const user = await requireUser();

  const [unread, hours, content] = await Promise.all([
    unreadNotificationCount(user.id),
    getBusinessHours(),
    getSiteContent(),
  ]);

  const today = hours.find((day) => day.dayOfWeek === new Date().getDay());

  return (
    <div className="section pt-10">
      <div className="container-page">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">My account</p>
            <h1 className="mt-2 text-3xl md:text-4xl">Hello, {user.firstName}</h1>
            <p className="mt-2 text-sm text-muted">
              Manage your appointments, saved designs and account details.
            </p>
          </div>

          <Link href="/booking" className="btn-primary">
            <CalendarCheck size={16} /> Book appointment
          </Link>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <AccountNav unread={unread} />

            <div className="mt-6 hidden rounded-2xl bg-cream-deep p-5 text-xs text-muted lg:block">
              <p className="inline-flex items-center gap-1.5 font-medium text-charcoal-soft">
                <Sparkles size={13} className="text-rosegold" /> Studio today
              </p>
              <p className="mt-2">
                {today ? (
                  today.isOpen ? (
                    <>
                      Open {formatMinutes(today.openMinutes)} – {formatMinutes(today.closeMinutes)}
                    </>
                  ) : (
                    "Closed today — book online any time."
                  )
                ) : null}
              </p>
              <p className="mt-3">{content.hoursNote}</p>
            </div>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
