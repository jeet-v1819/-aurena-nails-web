"use client";

/** Sidebar (desktop) / scrollable tabs (mobile) navigation for the account area. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarCheck, Heart, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/profile", label: "My profile", icon: UserRound },
  { href: "/appointments", label: "Appointments", icon: CalendarCheck },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/notifications", label: "Notifications", icon: Bell },
] as const;

export function AccountNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Account sections" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0">
      <ul className="flex gap-2 sm:flex-col sm:gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;

          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition",
                  active
                    ? "bg-blush text-rosegold-dark"
                    : "text-charcoal-soft hover:bg-cream-deep hover:text-charcoal"
                )}
              >
                <Icon size={16} />
                {link.label}
                {link.href === "/notifications" && unread > 0 ? (
                  <span className="ml-auto rounded-full bg-rosegold px-2 py-0.5 text-[0.65rem] font-medium text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
