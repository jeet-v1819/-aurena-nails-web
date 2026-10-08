"use client";

/**
 * Admin chrome: a calm, organised sidebar with the studio's own typography.
 * Collapses into a slide-over drawer on tablet/mobile.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CalendarOff,
  Clapperboard,
  FileText,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Star,
  Tag,
  UserRoundCog,
  Users,
  X,
  Clock,
} from "lucide-react";
import { logoutToLoginAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

const NAV: Array<{ href: string; label: string; icon: typeof LayoutDashboard; group: string }> = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarDays, group: "Overview" },
  { href: "/admin/customers", label: "Customers", icon: Users, group: "People" },
  { href: "/admin/reviews", label: "Reviews", icon: Star, group: "People" },
  { href: "/admin/messages", label: "Messages", icon: Inbox, group: "People" },
  { href: "/admin/services", label: "Services", icon: Sparkles, group: "Catalogue" },
  { href: "/admin/categories", label: "Categories", icon: Tag, group: "Catalogue" },
  { href: "/admin/gallery", label: "Gallery", icon: Images, group: "Catalogue" },
  { href: "/admin/videos", label: "Videos", icon: Clapperboard, group: "Catalogue" },
  { href: "/admin/content", label: "Website content", icon: FileText, group: "Studio" },
  { href: "/admin/business-hours", label: "Business hours", icon: Clock, group: "Studio" },
  { href: "/admin/holidays", label: "Holidays & closures", icon: CalendarOff, group: "Studio" },
  { href: "/admin/settings", label: "Settings", icon: Settings, group: "Studio" },
];

const GROUPS = ["Overview", "People", "Catalogue", "Studio"] as const;

export function AdminShell({
  adminName,
  unreadMessages,
  pendingAppointments,
  children,
}: {
  adminName: string;
  unreadMessages: number;
  pendingAppointments: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const badgeFor = (href: string) => {
    if (href === "/admin/messages") return unreadMessages;
    if (href === "/admin/appointments") return pendingAppointments;
    return 0;
  };

  const nav = (
    <nav aria-label="Admin sections" className="space-y-6">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="px-3 text-[0.62rem] uppercase tracking-[0.2em] text-muted">{group}</p>
          <ul className="mt-2 space-y-0.5">
            {NAV.filter((item) => item.group === group).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const badge = badgeFor(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-blush font-medium text-rosegold-dark"
                        : "text-charcoal-soft hover:bg-cream-deep hover:text-charcoal"
                    )}
                  >
                    <Icon size={16} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {badge > 0 ? (
                      <span className="rounded-full bg-rosegold px-1.5 py-0.5 text-[0.6rem] text-white">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="admin-shell min-h-screen bg-cream">
      {/* ------------------------------------------------------ top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="rounded-xl border border-line bg-white p-2 lg:hidden"
            aria-label="Open admin menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={18} />
          </button>

          <Link href="/admin/dashboard" className="inline-flex items-center gap-2 font-display text-lg">
            <Sparkles size={18} className="text-rosegold" />
            Aurena Admin
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-xl border border-line bg-white px-3 py-2 text-xs text-charcoal-soft transition hover:border-rosegold-soft sm:inline-flex"
              target="_blank"
              rel="noopener noreferrer"
            >
              View website
            </Link>

            <Link
              href="/admin/messages"
              className="relative rounded-xl border border-line bg-white p-2 text-charcoal-soft transition hover:border-rosegold-soft"
              aria-label={`Messages${unreadMessages ? `, ${unreadMessages} unread` : ""}`}
            >
              <Bell size={18} />
              {unreadMessages > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rosegold" />
              ) : null}
            </Link>

            <div className="hidden items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 sm:flex">
              <UserRoundCog size={16} className="text-rosegold" />
              <span className="max-w-[10rem] truncate text-xs text-charcoal-soft">{adminName}</span>
            </div>

            <form action={logoutToLoginAction}>
              <button
                type="submit"
                className="rounded-xl border border-line bg-white p-2 text-charcoal-soft transition hover:border-rosegold-soft hover:text-rosegold-dark"
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 sm:px-6">
        {/* ---------------------------------------------------- sidebar */}
        <aside className="sticky top-[5.5rem] hidden h-[calc(100vh-7rem)] w-64 shrink-0 overflow-y-auto rounded-2xl border border-line bg-white p-4 lg:block">
          {nav}

          <div className="mt-6 rounded-xl bg-cream-deep p-4 text-xs text-muted">
            <p className="inline-flex items-center gap-1.5 font-medium text-charcoal-soft">
              <BarChart3 size={13} className="text-rosegold" /> Studio tip
            </p>
            <p className="mt-2">
              Confirm pending appointments before the end of each day so clients get timely emails.
            </p>
          </div>
        </aside>

        {/* ------------------------------------------------- mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 h-full w-full bg-charcoal/40 backdrop-blur-sm"
              aria-label="Close admin menu"
              onClick={() => setOpen(false)}
            />
            <div className="relative z-10 h-full w-72 max-w-[85%] overflow-y-auto border-r border-line bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg">Aurena Admin</span>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-xl p-2">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-5">{nav}</div>
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}

/** Page header used by every admin screen. */
export function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow = "Admin",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted">{eyebrow}</p>
        <h1 className="mt-1.5 font-display text-2xl sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
