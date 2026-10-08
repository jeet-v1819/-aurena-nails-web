import type { MetadataRoute } from "next";

/** Search engines may index the public site; private and admin areas stay out. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/profile",
          "/appointments",
          "/wishlist",
          "/notifications",
          "/forbidden",
          "/unauthorized",
          "/login",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
