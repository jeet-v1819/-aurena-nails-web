import { Suspense } from "react";
import "./globals.css";
import Providers from "@/components/providers";
import Header from "@/components/header";
import Footer from "@/components/footer";

export const metadata = {
  title: {
    default: "E-Shop — Multi-Vendor Marketplace",
    template: "%s | E-Shop",
  },
  description:
    "A multi-vendor e-commerce platform: browse products from independent sellers, manage a cart and wishlist, track orders, and run seller and admin dashboards.",
  applicationName: "E-Shop",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15803d",
};

/**
 * Root layout.
 *
 * The header and footer now live here once, instead of being rendered inside
 * individual pages. The previous pages each rendered <Header /> (and sometimes a
 * second brand block via <Navigation />), which produced duplicated logos and
 * inconsistent chrome — and the header itself was missing its "use client"
 * directive, so importing it into a server page was a build error.
 *
 * Deliberate design note: this layout does NOT call getServerSession(). Keeping
 * the session on the client (SessionProvider) means no page reads the database
 * during `next build`, so the production build never depends on DATABASE_URL
 * being reachable at build time — only at runtime.
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
          >
            Skip to main content
          </a>

          <Header />

          <main id="main-content" className="flex flex-1 flex-col">
            {/*
             * Every page in this app is a Client Component that reads the URL
             * (useSearchParams) to drive its filters, and several share
             * <Navigation />, which does the same. Next.js refuses to prerender a
             * useSearchParams() call that is not inside a Suspense boundary, so
             * this single boundary at the root covers every route at once instead
             * of repeating <Suspense> in a dozen page files. Pages that already
             * wrap their own content keep their more specific fallback.
             */}
            <Suspense fallback={null}>{children}</Suspense>
          </main>

          <Footer />
        </Providers>
      </body>
    </html>
  );
}
