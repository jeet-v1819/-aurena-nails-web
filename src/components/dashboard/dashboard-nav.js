"use client";

/**
 * Sidebar navigation for the admin and seller consoles.
 *
 * Both consoles share one component; the link set is chosen by role so a seller
 * never sees admin destinations (and the API layer independently refuses them).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLES } from "@/lib/constants";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview", exact: true, icon: "chart" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/sellers", label: "Sellers", icon: "store" },
  { href: "/admin/products", label: "Products", icon: "box" },
  { href: "/admin/orders", label: "Orders", icon: "cart" },
];

const SELLER_LINKS = [
  { href: "/seller", label: "Overview", exact: true, icon: "chart" },
  { href: "/seller/products", label: "My products", icon: "box" },
  { href: "/seller/orders", label: "My orders", icon: "cart" },
];

const GLYPHS = {
  chart: "M4 20V10m5 10V4m5 16v-7m5 7V8",
  users: "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11m7 9a6 6 0 0 0-12 0m14.5-8.5a3 3 0 0 0 0-5.6M21 20a6 6 0 0 0-2.5-4.9",
  store: "M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9l1.5-4h13L20 9M9 20v-5h6v5",
  box: "M20 7 12 3 4 7m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10",
  cart: "M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.55L21 8H6M10 20h.01M18 20h.01",
};

export default function DashboardNav({ role, title, subtitle }) {
  const pathname = usePathname();
  const links = role === ROLES.ADMIN ? ADMIN_LINKS : SELLER_LINKS;

  return (
    <aside className="lg:w-60 lg:shrink-0">
      <div className="card p-4">
        <div className="mb-4 border-b border-gray-100 pb-3">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
        </div>

        <nav aria-label="Dashboard" className="space-y-1">
          {links.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-primary text-white" : "text-gray-700 hover:bg-gray-100 hover:text-primary"
                }`}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d={GLYPHS[link.icon] || GLYPHS.chart} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-gray-100 pt-3">
          <Link href="/" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-primary">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to store
          </Link>
        </div>
      </div>
    </aside>
  );
}
