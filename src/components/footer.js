import Link from "next/link";

/**
 * Site footer.
 *
 * The README's structure lists `components/footer/`; the folder existed in the
 * plan but no footer component had been written, so pages ended abruptly.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link href="/" className="text-xl font-bold text-primary">
            E-Shop
          </Link>
          <p className="mt-3 max-w-sm text-sm text-gray-600">
            A multi-vendor marketplace connecting independent sellers with shoppers. Browse, compare and buy from
            multiple stores in a single checkout.
          </p>
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Demo environment — payments are simulated. No real payment gateway is configured and no card data is
            processed.
          </p>
        </div>

        <nav aria-label="Shop">
          <h3 className="text-sm font-semibold text-gray-900">Shop</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>
              <Link href="/products" className="hover:text-primary hover:underline">
                All products
              </Link>
            </li>
            <li>
              <Link href="/categories" className="hover:text-primary hover:underline">
                Categories
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-primary hover:underline">
                Cart
              </Link>
            </li>
            <li>
              <Link href="/wishlist" className="hover:text-primary hover:underline">
                Wishlist
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account">
          <h3 className="text-sm font-semibold text-gray-900">Account</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>
              <Link href="/login" className="hover:text-primary hover:underline">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-primary hover:underline">
                Create an account
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-primary hover:underline">
                Order history
              </Link>
            </li>
            <li>
              <Link href="/profile" className="hover:text-primary hover:underline">
                Profile
              </Link>
            </li>
            <li>
              <Link href="/seller" className="hover:text-primary hover:underline">
                Sell on E-Shop
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-gray-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:px-6">
          <p>© {year} E-Shop. Built with Next.js 16, Prisma 7 and Tailwind CSS 4.</p>
          <p>Admin, seller and customer demo accounts are listed in the README.</p>
        </div>
      </div>
    </footer>
  );
}
