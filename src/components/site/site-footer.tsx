import Link from "next/link";
import { Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { Facebook, Instagram, WhatsApp, Youtube } from "@/components/ui/brand-icons";
import { whatsappLink } from "@/lib/constants";
import { formatMinutes } from "@/lib/format";
import type { BusinessHour } from "@/server/services/business-hours";
import type { SiteContent } from "@/lib/content/defaults";

export function SiteFooter({
  content,
  hours,
  services,
}: {
  content: SiteContent;
  hours: BusinessHour[];
  services: Array<{ name: string; slug: string }>;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-cream-deep">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rosegold to-rosegold-dark text-white">
              <Sparkles size={18} />
            </span>
            <span className="font-display text-lg">{content.siteName}</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{content.footerNote}</p>

          <div className="mt-5 flex items-center gap-2">
            <SocialLink href={content.instagram} label="Instagram">
              <Instagram size={16} />
            </SocialLink>
            <SocialLink href={content.facebook} label="Facebook">
              <Facebook size={16} />
            </SocialLink>
            <SocialLink href={content.youtube} label="YouTube">
              <Youtube size={16} />
            </SocialLink>
            <a
              href={whatsappLink(content.whatsapp, content.whatsappMessage)}
              target="_blank"
              rel="noreferrer noopener"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-success transition hover:border-success"
              aria-label="Chat on WhatsApp"
            >
              <WhatsApp size={16} />
            </a>
          </div>
        </div>

        <nav aria-label="Quick links">
          <h2 className="font-display text-base">Quick links</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <FooterLink href="/about">About the studio</FooterLink>
            <FooterLink href="/services">All services</FooterLink>
            <FooterLink href="/gallery">Nail art gallery</FooterLink>
            <FooterLink href="/videos">Video gallery</FooterLink>
            <FooterLink href="/booking">Book an appointment</FooterLink>
            <FooterLink href="/contact">Contact us</FooterLink>
          </ul>
        </nav>

        <nav aria-label="Popular services">
          <h2 className="font-display text-base">Popular services</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            {services.slice(0, 6).map((service) => (
              <FooterLink key={service.slug} href={`/services/${service.slug}`}>
                {service.name}
              </FooterLink>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="font-display text-base">Visit &amp; contact</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li className="flex gap-2.5">
              <MapPin size={16} className="mt-0.5 shrink-0 text-rosegold" />
              <span>{content.address}</span>
            </li>
            <li className="flex gap-2.5">
              <Phone size={16} className="mt-0.5 shrink-0 text-rosegold" />
              <a href={`tel:${content.phone.replace(/\s/g, "")}`} className="hover:text-charcoal">
                {content.phone}
              </a>
            </li>
            <li className="flex gap-2.5">
              <Mail size={16} className="mt-0.5 shrink-0 text-rosegold" />
              <a href={`mailto:${content.email}`} className="hover:text-charcoal">
                {content.email}
              </a>
            </li>
          </ul>

          <h3 className="mt-6 font-display text-base">Opening hours</h3>
          <ul className="mt-3 space-y-1.5 text-xs text-muted">
            {hours.map((day) => (
              <li key={day.dayOfWeek} className="flex justify-between gap-4">
                <span>{day.dayName}</span>
                <span className={day.isOpen ? "text-charcoal-soft" : "text-rosegold"}>
                  {day.isOpen ? `${formatMinutes(day.openMinutes)} – ${formatMinutes(day.closeMinutes)}` : "Closed"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-xs text-muted sm:flex-row">
          <p>
            © {year} {content.siteName}. All rights reserved.
          </p>
          <p className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/login" className="hover:text-charcoal">
              Customer login
            </Link>
            <Link href="/register" className="hover:text-charcoal">
              Create account
            </Link>
            <Link href="/admin/login" className="hover:text-charcoal">
              Studio admin
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="link-underline transition hover:text-charcoal">
        {children}
      </Link>
    </li>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-charcoal-soft transition hover:border-rosegold hover:text-rosegold"
    >
      {children}
    </a>
  );
}
