"use client";

/**
 * Site header.
 *
 * Fixes versus the original:
 *   - MISSING "use client". The component calls useState/useEffect/useSession,
 *     so under the App Router it must be a Client Component. Without the
 *     directive `next build` fails with "useState only works in a Client
 *     Component".
 *   - Auth state was a hardcoded `setUser(null)` placeholder. It now reads the
 *     real NextAuth session, so login/logout/role-aware links actually work.
 *   - `bg-secondary-transitions` is not a real class (it was a typo for a
 *     transition utility); replaced with `bg-primary-dark`.
 *   - The heart and cart SVG `path` data was malformed and rendered as blobs;
 *     replaced with correct icon geometry.
 *   - Cart / wishlist badges showed a hardcoded 0; they now reflect real counts.
 *   - Added the search field and account menu the navigation component expected.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { ROLES } from "@/lib/constants";

function CartIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.55L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HeartIcon({ className = "h-5 w-5", filled = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" strokeLinecap="round" />
    </svg>
  );
}

function Badge({ count, label }) {
  if (!count) return null;
  return (
    <span
      aria-label={label}
      className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState({ cartCount: 0, cartItems: 0, wishlistCount: 0 });

  const accountRef = useRef(null);

  const user = session?.user || null;
  const isAuthenticated = status === "authenticated" && Boolean(user?.id);

  const refreshCounts = useCallback(async () => {
    try {
      const data = await api.get("/api/counts");
      setCounts({
        cartCount: data.cartCount || 0,
        cartItems: data.cartItems || 0,
        wishlistCount: data.wishlistCount || 0,
      });
    } catch {
      setCounts({ cartCount: 0, cartItems: 0, wishlistCount: 0 });
    }
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, isAuthenticated, pathname]);

  // Let cart/wishlist pages tell the header their contents changed.
  useEffect(() => {
    const onUpdated = () => refreshCounts();
    window.addEventListener("shop:counts-changed", onUpdated);
    return () => window.removeEventListener("shop:counts-changed", onUpdated);
  }, [refreshCounts]);

  // Close the account dropdown on an outside click.
  useEffect(() => {
    function onClickOutside(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) setIsAccountOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setIsMenuOpen(false);
    setIsAccountOpen(false);
  }, [pathname]);

  const dashboardHref = user?.role === ROLES.ADMIN ? "/admin" : user?.role === ROLES.SELLER ? "/seller" : null;

  function submitSearch(event) {
    event.preventDefault();
    const term = search.trim();
    router.push(term ? `/products?search=${encodeURIComponent(term)}` : "/products");
  }

  async function handleLogout() {
    setIsAccountOpen(false);
    setIsMenuOpen(false);
    await signOut({ redirect: false });
    setCounts({ cartCount: 0, cartItems: 0, wishlistCount: 0 });
    router.push("/");
    router.refresh();
  }

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Products" },
    { href: "/categories", label: "Categories" },
    ...(dashboardHref ? [{ href: dashboardHref, label: "Dashboard" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="shrink-0 text-xl font-bold text-primary sm:text-2xl">
          E-Shop
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === link.href ? "text-primary" : "text-gray-600"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Search */}
        <form onSubmit={submitSearch} className="ml-auto hidden min-w-0 flex-1 items-center md:flex md:max-w-xs">
          <label htmlFor="header-search" className="sr-only">
            Search products
          </label>
          <div className="relative w-full">
            <input
              id="header-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              className="input pr-9"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400 hover:text-primary"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </form>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href="/wishlist" className="relative rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary" aria-label="Wishlist">
            <HeartIcon />
            <Badge count={counts.wishlistCount} label="wishlist items" />
          </Link>

          <Link href="/cart" className="relative rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary" aria-label="Cart">
            <CartIcon />
            <Badge count={counts.cartItems || counts.cartCount} label="cart items" />
          </Link>

          {status === "loading" ? (
            <span className="hidden h-9 w-9 animate-pulse rounded-full bg-gray-200 sm:block" aria-hidden="true" />
          ) : isAuthenticated ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setIsAccountOpen((open) => !open)}
                aria-expanded={isAccountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary"
              >
                <UserIcon />
                <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
                  {user?.name || user?.email || "Account"}
                </span>
              </button>

              {isAccountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-gray-900">{user?.name || "Account"}</p>
                    <p className="truncate text-xs text-gray-500">{user?.email}</p>
                    <span className="badge mt-2 bg-gray-100 text-gray-700">{user?.role}</span>
                  </div>

                  <Link role="menuitem" href="/profile" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary">
                    My profile
                  </Link>
                  <Link role="menuitem" href="/orders" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary">
                    My orders
                  </Link>
                  <Link role="menuitem" href="/wishlist" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary">
                    Wishlist
                  </Link>
                  {dashboardHref && (
                    <Link role="menuitem" href={dashboardHref} className="block px-4 py-2.5 text-sm font-medium text-primary hover:bg-gray-50">
                      {user?.role === ROLES.ADMIN ? "Admin dashboard" : "Seller dashboard"}
                    </Link>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="block w-full border-t border-gray-100 px-4 py-2.5 text-left text-sm text-danger hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="btn-ghost px-3 py-1.5">
                Login
              </Link>
              <Link href="/register" className="btn-primary px-3 py-1.5">
                Register
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-label="Toggle menu"
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-primary md:hidden"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {isMenuOpen ? (
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-4 md:hidden">
          <form onSubmit={submitSearch} className="mb-4">
            <label htmlFor="mobile-search" className="sr-only">
              Search products
            </label>
            <input
              id="mobile-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              className="input"
            />
          </form>

          <nav className="space-y-1" aria-label="Mobile">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="block rounded-md px-2 py-2 text-base text-gray-700 hover:bg-gray-50 hover:text-primary">
                {link.label}
              </Link>
            ))}
            <Link href="/wishlist" className="block rounded-md px-2 py-2 text-base text-gray-700 hover:bg-gray-50 hover:text-primary">
              Wishlist
            </Link>
            <Link href="/cart" className="block rounded-md px-2 py-2 text-base text-gray-700 hover:bg-gray-50 hover:text-primary">
              Cart
            </Link>
          </nav>

          <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
            {isAuthenticated ? (
              <>
                <p className="px-2 text-sm text-gray-600">
                  Signed in as <span className="font-medium text-gray-900">{user?.email}</span>
                </p>
                <Link href="/profile" className="block rounded-md px-2 py-2 text-base text-gray-700 hover:bg-gray-50 hover:text-primary">
                  My profile
                </Link>
                <Link href="/orders" className="block rounded-md px-2 py-2 text-base text-gray-700 hover:bg-gray-50 hover:text-primary">
                  My orders
                </Link>
                <button type="button" onClick={handleLogout} className="block w-full rounded-md px-2 py-2 text-left text-base text-danger hover:bg-red-50">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-outline w-full">
                  Login
                </Link>
                <Link href="/register" className="btn-primary w-full">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export { CartIcon, HeartIcon, UserIcon };
