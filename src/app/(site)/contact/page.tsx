import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteContent } from "@/server/services/content";
import { getBusinessHours } from "@/server/services/business-hours";
import { ContactForm } from "@/components/site/contact-form";
import { Instagram, Facebook, WhatsApp } from "@/components/ui/brand-icons";
import { formatMinutes } from "@/lib/format";
import { whatsappLink } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: "Contact & Location",
    description: `Visit or contact ${content.siteName} — ${content.address}. Call ${content.phone}, message us on WhatsApp, or send an enquiry and we will reply within one working day.`,
    alternates: { canonical: "/contact" },
  };
}

export default async function ContactPage() {
  const [content, hours, user] = await Promise.all([getSiteContent(), getBusinessHours(), getCurrentUser()]);

  return (
    <>
      <section className="surface-gradient border-b border-line">
        <div className="container-page py-14">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link href="/" className="hover:text-charcoal">
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-charcoal-soft">Contact</span>
          </nav>

          <div className="mt-5 max-w-3xl">
            <p className="eyebrow">Say hello</p>
            <h1 className="mt-3 text-4xl md:text-5xl">We would love to hear from you</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
              Questions about a design, bridal parties, group bookings or after-care — send us a message, call, or drop
              by the studio during opening hours.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <h2 className="font-display text-2xl">Studio details</h2>

            <ul className="mt-6 space-y-5 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush text-rosegold">
                  <MapPin size={17} />
                </span>
                <div>
                  <p className="font-medium">Visit us</p>
                  <p className="mt-1 text-muted">{content.address}</p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush text-rosegold">
                  <Phone size={17} />
                </span>
                <div>
                  <p className="font-medium">Call the studio</p>
                  <a href={`tel:${content.phone.replace(/\s/g, "")}`} className="mt-1 block text-muted hover:text-rosegold-dark">
                    {content.phone}
                  </a>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush text-rosegold">
                  <Mail size={17} />
                </span>
                <div>
                  <p className="font-medium">Email</p>
                  <a href={`mailto:${content.email}`} className="mt-1 block text-muted hover:text-rosegold-dark">
                    {content.email}
                  </a>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush text-rosegold">
                  <MessageCircle size={17} />
                </span>
                <div>
                  <p className="font-medium">WhatsApp</p>
                  <a
                    href={whatsappLink(content.whatsapp, content.whatsappMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-muted hover:text-rosegold-dark"
                  >
                    <WhatsApp size={14} /> Chat with the studio
                  </a>
                </div>
              </li>
            </ul>

            <div className="mt-8 card p-6">
              <h3 className="flex items-center gap-2 font-display text-lg">
                <Clock size={16} className="text-rosegold" /> Opening hours
              </h3>
              <dl className="mt-4 space-y-2 text-sm">
                {hours.map((day) => (
                  <div key={day.dayOfWeek} className="flex items-center justify-between border-b border-line pb-1.5">
                    <dt className="text-muted">{day.dayName}</dt>
                    <dd className={day.isOpen ? "text-charcoal-soft" : "text-muted"}>
                      {day.isOpen
                        ? `${formatMinutes(day.openMinutes)} – ${formatMinutes(day.closeMinutes)}`
                        : "Closed"}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted">{content.hoursNote}</p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              {content.instagram ? (
                <a
                  href={content.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-charcoal-soft transition hover:border-rosegold-soft hover:text-rosegold"
                >
                  <Instagram size={17} />
                </a>
              ) : null}
              {content.facebook ? (
                <a
                  href={content.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-charcoal-soft transition hover:border-rosegold-soft hover:text-rosegold"
                >
                  <Facebook size={17} />
                </a>
              ) : null}
            </div>
          </div>

          <div>
            <div className="card p-6 sm:p-8">
              <h2 className="font-display text-2xl">Send us a message</h2>
              <p className="mt-2 text-sm text-muted">
                Fill in the form and your message lands straight in the studio inbox. You can also book online — it is
                the fastest way to secure a slot.
              </p>

              <div className="mt-6">
                <ContactForm
                  defaultName={user ? `${user.firstName} ${user.lastName}`.trim() : ""}
                  defaultEmail={user?.email ?? ""}
                  defaultMobile={user?.mobile ?? ""}
                />
              </div>
            </div>

            {content.mapEmbedUrl ? (
              <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-line">
                <iframe
                  src={content.mapEmbedUrl}
                  title={`Map showing ${content.siteName}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-[320px] w-full"
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
