import type { Metadata, Viewport } from "next";

// Self-hosted webfonts (no external font CDN at runtime).
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";

import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { getSiteContent } from "@/server/services/content";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: `${content.siteName} — ${content.tagline}`,
      template: `%s | ${content.siteName}`,
    },
    description: content.seoDescription,
    applicationName: content.siteName,
    keywords: [
      "nail art",
      "nail salon",
      "gel nails",
      "acrylic nails",
      "bridal nails",
      "nail extensions",
      "luxury nail studio",
      "Aurena Nails",
    ],
    authors: [{ name: content.siteName }],
    openGraph: {
      type: "website",
      siteName: content.siteName,
      title: `${content.siteName} — ${content.tagline}`,
      description: content.seoDescription,
      url: appUrl,
      images: [{ url: content.heroImage, width: 1200, height: 630, alt: content.siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${content.siteName} — ${content.tagline}`,
      description: content.seoDescription,
      images: [content.heroImage],
    },
    robots: { index: true, follow: true },
    icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: "#b76e79",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-charcoal antialiased">
        {children}
        {/* Toast notifications (success / error / confirmations). */}
        <Toaster />
      </body>
    </html>
  );
}
