/** @type {import('next').NextConfig} */

/**
 * Packages that must NOT be bundled by webpack and should stay as real Node
 * modules at runtime.
 *
 * Prisma 7 loads a WASM query compiler and native/adapter packages at runtime;
 * bundling them produces "Cannot find module" or broken WASM loading inside the
 * serverless output. bcryptjs and pg are native/dynamic-require packages too.
 */
const serverExternalPackages = [
  "@prisma/client",
  ".prisma/client",
  "@prisma/adapter-pg",
  "@prisma/adapter-libsql",
  "@prisma/adapter-better-sqlite3",
  "@prisma/driver-adapter-utils",
  "@libsql/client",
  "pg",
  "bcryptjs",
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages,

  // Product images come from arbitrary merchant-supplied URLs, so the optimiser
  // must accept any https host. The UI also uses plain <img> in several places
  // (preserved from the original markup), which bypasses the optimiser.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // The project is JavaScript-only. `ignoreBuildErrors` is a safety net in case
  // a tool ever drops a .d.ts into the tree; no application source is TS.
  typescript: {
    ignoreBuildErrors: true,
  },

  /**
   * `@prisma/adapter-better-sqlite3` is an OPTIONAL dependency: it needs a
   * native addon that cannot be compiled on every machine or CI image. When it
   * is absent, prisma/adapter.js falls back to the pure-JS libSQL adapter at
   * runtime — the try/catch around the require is intentional.
   *
   * webpack still reports "Module not found" for that one require, which makes
   * an otherwise clean build print a warning. Silence exactly that, and only
   * that: the rule is scoped to prisma/adapter.js and to this module name, so a
   * genuinely broken import anywhere else still fails the build.
   */
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /prisma[\\/]adapter\.js$/,
        message: /Can't resolve '@prisma\/adapter-better-sqlite3'/,
      },
    ];
    return config;
  },

  async headers() {
    return [
      {
        // Never let a browser or CDN cache an authenticated API response.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

module.exports = nextConfig;
