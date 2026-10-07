import Link from "next/link";

/**
 * 404 page. The project had none, so an unknown URL rendered Next's bare
 * default. Kept as a Server Component (no hooks, no data fetching) so it stays
 * statically renderable and cannot fail at runtime.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="text-6xl font-black text-primary/20" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        The page you were looking for has moved, been removed, or never existed.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary">
          Back to home
        </Link>
        <Link href="/products" className="btn-outline">
          Browse products
        </Link>
      </div>

      <ul className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
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
          <Link href="/orders" className="hover:text-primary hover:underline">
            My orders
          </Link>
        </li>
        <li>
          <Link href="/login" className="hover:text-primary hover:underline">
            Sign in
          </Link>
        </li>
      </ul>
    </div>
  );
}
