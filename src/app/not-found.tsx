import Link from "next/link";
import { CalendarCheck, Home, Search, Sparkles } from "lucide-react";
import { getSiteContent } from "@/server/services/content";
import { getBusinessHours } from "@/server/services/business-hours";
import { formatMinutes } from "@/lib/format";

/**
 * 404 — friendly, on-brand and genuinely useful: the visitor gets a way back
 * into the site plus the studio's opening hours.
 */
export default async function NotFound() {
  const [content, hours] = await Promise.all([getSiteContent(), getBusinessHours()]).catch(() => [null, null]);

  return (
    <section className="section">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Error 404</p>
          <h1 className="mt-3 text-4xl md:text-5xl">This page has been filed away</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
            The link may be old, or the page may have moved. Everything else is exactly where you left it — try the
            service menu, the design gallery, or book an appointment.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-primary">
              <Home size={16} /> Back to home
            </Link>
            <Link href="/services" className="btn-outline">
              <Sparkles size={16} /> Browse services
            </Link>
            <Link href="/booking" className="btn-outline">
              <CalendarCheck size={16} /> Book appointment
            </Link>
          </div>

          <div className="card-soft mx-auto mt-10 max-w-md p-6 text-left">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Search size={15} className="text-rosegold" /> Looking for something specific?
            </p>
            <p className="mt-2 text-sm text-muted">
              Try the search box in the header, or call the studio
              {content ? ` on ${content.phone}` : ""}. We are happy to point you in the right direction.
            </p>

            {hours ? (
              <dl className="mt-4 grid gap-1.5 text-xs text-muted sm:grid-cols-2">
                {hours
                  .filter((day) => day.isOpen)
                  .map((day) => (
                    <div key={day.dayOfWeek} className="flex items-center justify-between gap-3 border-b border-line pb-1">
                      <dt>{day.dayName}</dt>
                      <dd>
                        {formatMinutes(day.openMinutes)} – {formatMinutes(day.closeMinutes)}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
