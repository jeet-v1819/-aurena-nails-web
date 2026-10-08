"use client";

/**
 * Public site header: sticky nav, mobile drawer, account menu.
 * Receives already-resolved session data from the server layout so no client
 * fetch is needed for navigation state.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CalendarCheck, Heart, LayoutDashboard, LogOut, Menu, Search, Sparkles, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export type HeaderUser = {
  fullName: string;
  firstName: string;
  role: "ADMIN" | "CUSTOMER";
  avatarUrl: string | null;
  unreadNotifications: number;
} | null;

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Gallery" },
  { href: "/videos", label: "Videos" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ user, siteName, tagline }: { user: HeaderUser; siteName: string; tagline: string }) {
  const pathname = usePathname();
  // Menus remember which route they were opened on, so navigating closes them
  // without an effect that would set state during a render pass.
  const [mobileOpenFor, setMobileOpenFor] = useState<string | null>(null);
  const [accountOpenFor, setAccountOpenFor] = useState<string | null>(null);
  const mobileOpen = mobileOpenFor === pathname;
  const accountOpen = accountOpenFor === pathname;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled ? "border-line bg-cream/95 backdrop-blur-md" : "border-transparent bg-cream/70 backdrop-blur-sm"
      )}
    >
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${siteName} home`}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rosegold to-rosegold-dark text-white shadow-[var(--shadow-glow)]">
            <Sparkles size={18} />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg tracking-wide">{siteName}</span>
            <span className="hidden text-[0.6rem] uppercase tracking-[0.28em] text-muted sm:block">{tagline}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "link-underline rounded-full px-3 py-2 text-sm transition",
                isActive(link.href) ? "text-rosegold-dark" : "text-charcoal-soft hover:text-charcoal"
              )}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="hidden rounded-full p-2 text-charcoal-soft transition hover:bg-cream-deep hover:text-charcoal sm:block"
            aria-label="Search services, gallery and videos"
          >
            <Search size={18} />
          </Link>

          <Link href="/booking" className="btn-primary btn-sm hidden sm:inline-flex">
            <CalendarCheck size={16} />
            Book Appointment
          </Link>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpenFor((open) => (open === pathname ? null : pathname))}
                className="flex items-center gap-2 rounded-full border border-line bg-white/80 py-1 pl-1 pr-3 transition hover:border-rosegold-soft"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-blush text-xs font-medium text-rosegold-dark">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(user.firstName)
                  )}
                </span>
                <span className="hidden max-w-24 truncate text-xs sm:block">{user.firstName}</span>
                {user.unreadNotifications > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rosegold px-1 text-[0.65rem] text-white">
                    {user.unreadNotifications > 9 ? "9+" : user.unreadNotifications}
                  </span>
                ) : null}
              </button>

              <AnimatePresence>
                {accountOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    role="menu"
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]"
                  >
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-sm font-medium">{user.fullName}</p>
                      <p className="text-xs text-muted">{user.role === "ADMIN" ? "Studio administrator" : "Customer"}</p>
                    </div>
                    <AccountLink href="/profile" icon={<User size={15} />} label="My profile" />
                    <AccountLink href="/appointments" icon={<CalendarCheck size={15} />} label="My appointments" />
                    <AccountLink href="/wishlist" icon={<Heart size={15} />} label="Wishlist" />
                    <AccountLink
                      href="/notifications"
                      icon={<Bell size={15} />}
                      label="Notifications"
                      badge={user.unreadNotifications}
                    />
                    {user.role === "ADMIN" ? (
                      <AccountLink href="/admin/dashboard" icon={<LayoutDashboard size={15} />} label="Admin dashboard" />
                    ) : null}
                    <form action="/api/auth/logout" method="post">
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger transition hover:bg-cream"
                      >
                        <LogOut size={15} /> Log out
                      </button>
                    </form>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <Link href="/login" className="btn-outline btn-sm hidden sm:inline-flex">
              Login
            </Link>
          )}

          <button
            type="button"
            className="rounded-full p-2 text-charcoal transition hover:bg-cream-deep lg:hidden"
            onClick={() => setMobileOpenFor(pathname)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-charcoal/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpenFor(null)}
          >
            <motion.nav
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="ml-auto flex h-full w-[86%] max-w-sm flex-col bg-cream p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              aria-label="Mobile navigation"
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="font-display text-lg">{siteName}</span>
                <button
                  type="button"
                  onClick={() => setMobileOpenFor(null)}
                  className="rounded-full p-2 hover:bg-cream-deep"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-xl px-4 py-3 text-sm transition",
                      isActive(link.href) ? "bg-blush text-rosegold-dark" : "text-charcoal-soft hover:bg-cream-deep"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link href="/search" className="rounded-xl px-4 py-3 text-sm text-charcoal-soft hover:bg-cream-deep">
                  Search
                </Link>
              </div>

              <div className="mt-6 flex flex-col gap-2 border-t border-line pt-6">
                {user ? (
                  <>
                    <Link href="/profile" className="btn-outline w-full">
                      <User size={16} /> My profile
                    </Link>
                    <Link href="/appointments" className="btn-outline w-full">
                      <CalendarCheck size={16} /> My appointments
                    </Link>
                    <Link href="/wishlist" className="btn-outline w-full">
                      <Heart size={16} /> Wishlist
                    </Link>
                    <Link href="/notifications" className="btn-outline w-full">
                      <Bell size={16} /> Notifications
                      {user.unreadNotifications > 0 ? (
                        <span className="ml-auto rounded-full bg-rosegold px-2 text-[0.65rem] text-white">
                          {user.unreadNotifications}
                        </span>
                      ) : null}
                    </Link>
                    {user.role === "ADMIN" ? (
                      <Link href="/admin/dashboard" className="btn-outline w-full">
                        <LayoutDashboard size={16} /> Admin dashboard
                      </Link>
                    ) : null}
                    <Link href="/booking" className="btn-primary w-full">
                      <CalendarCheck size={16} /> Book Appointment
                    </Link>
                    <form action="/api/auth/logout" method="post" className="w-full">
                      <button type="submit" className="btn-outline w-full text-danger">
                        <LogOut size={16} /> Log out
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link href="/booking" className="btn-primary w-full">
                      <CalendarCheck size={16} /> Book Appointment
                    </Link>
                    <Link href="/login" className="btn-outline w-full">
                      Login
                    </Link>
                    <Link href="/register" className="btn-outline w-full">
                      Create account
                    </Link>
                  </>
                )}
              </div>
            </motion.nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function AccountLink({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 px-4 py-2.5 text-sm text-charcoal-soft transition hover:bg-cream"
    >
      {icon}
      {label}
      {badge ? <span className="ml-auto rounded-full bg-blush px-2 text-[0.65rem] text-rosegold-dark">{badge}</span> : null}
    </Link>
  );
}
