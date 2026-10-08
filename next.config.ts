import type { NextConfig } from "next";

/**
 * Prisma 7 talks to PostgreSQL through a driver adapter (`@prisma/adapter-pg`
 * + `pg`). Those packages hold native/introspection logic and must stay real
 * Node modules instead of being bundled by the server compiler. `bcryptjs` and
 * `nodemailer` are likewise used only inside Server Actions/route handlers.
 */
const serverExternalPackages = [
  "@prisma/client",
  "@prisma/adapter-pg",
  "prisma",
  "pg",
  "bcryptjs",
  "nodemailer",
];

/**
 * Clickjacking protection.
 *
 * Production keeps the strict `SAMEORIGIN` policy: nobody may embed the studio
 * site in a frame. Sandboxed/preview environments serve the app from a
 * different origin than the page that frames it, so the header would blank the
 * preview; set `ALLOW_FRAME_EMBEDDING=true` there (never in production) to fall
 * back to a `frame-ancestors` policy that permits it.
 */
const allowFraming = process.env.ALLOW_FRAME_EMBEDDING === "true";
const frameHeaders = allowFraming
  ? [{ key: "Content-Security-Policy", value: "frame-ancestors *" }]
  : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages,

  images: {
    // Cloudinary serves every uploaded asset; local development uploads are
    // served from /public/uploads. Remote avatars (Google/Gravatar style) are
    // allowed over https only.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },

  async headers() {
    return [
      {
        // Authenticated pages and APIs must never be cached by a proxy or CDN.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...frameHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
