/**
 * NextAuth configuration (server-only — imports Prisma and bcryptjs).
 *
 * Extracted out of pages/api/auth/[...nextauth].js so that API routes and
 * middleware-adjacent server code can call `getServerSession(req, res,
 * authOptions)` with the exact same options NextAuth itself uses.
 *
 * Security fixes applied here compared with the previous implementation:
 *   1. Passwords are now actually verified with bcrypt.compare(). The old
 *      `authorize()` only checked that the email appeared in a hardcoded list
 *      of seed addresses and accepted ANY password.
 *   2. Disabled accounts (status === false) cannot sign in.
 *   3. The Google provider is only registered when its env vars are present;
 *      previously it was always constructed with undefined clientId/secret,
 *      which made NextAuth throw on startup.
 *   4. Role and account status are refreshed from the database periodically, so
 *      an admin disabling a user or changing a role takes effect without the
 *      user having to log out.
 */
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { ROLES, ROLE_VALUES } from "@/lib/constants";

/** Only used when NODE_ENV !== "production" so local dev never hard-fails. */
const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-set-NEXTAUTH_SECRET";

const secret =
  process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === "production" ? undefined : DEV_FALLBACK_SECRET);

if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.warn("[auth] NEXTAUTH_SECRET is not set — using an insecure development fallback.");
}

/** How often (ms) a live JWT re-reads role/status from the database. */
const SESSION_REFRESH_MS = 5 * 60 * 1000;

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    image: user.image || null,
  };
}

const providers = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "you@example.com" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email || "").trim().toLowerCase();
      const password = String(credentials?.password || "");

      if (!email || !password) {
        throw new Error("Email and password are required.");
      }

      const user = await prisma.user.findUnique({ where: { email } });

      // No account, or an OAuth-only account with no password.
      if (!user || !user.password) return null;

      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) return null;

      if (user.status === false) {
        throw new Error("Your account has been disabled. Please contact support.");
      }

      return publicUser(user);
    },
  }),
];

// Register Google ONLY when configured, otherwise NextAuth throws while
// building the provider list because clientId/clientSecret are undefined.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const authOptions = {
  providers,
  secret,
  /**
   * ORIGIN HANDLING (read this before deploying behind a proxy).
   *
   * next-auth v4 resolves its callback origin in `detectOrigin()` as:
   *   1. NEXTAUTH_URL, if set;
   *   2. otherwise, `${x-forwarded-proto === "http" ? "http" : "https"}://${host}`
   *      but ONLY when VERCEL or AUTH_TRUST_HOST is set;
   *   3. otherwise undefined -> the "[NEXTAUTH_URL]" warning and broken
   *      sign-in redirects.
   *
   * There is no `trustHost` config option in v4 (that is Auth.js v5), so the
   * switch has to be the AUTH_TRUST_HOST environment variable:
   *   - Local development: set NEXTAUTH_URL="http://localhost:3000". Do NOT set
   *     AUTH_TRUST_HOST there — with no proxy in front, x-forwarded-proto is
   *     absent and the origin would be derived as https://localhost:3000.
   *   - Netlify / any reverse proxy / deploy previews: set AUTH_TRUST_HOST=true
   *     and leave NEXTAUTH_URL unset, so the origin follows the real host.
   * Both are documented in .env.example and README.md.
   */
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
    newUser: "/register",
  },
  callbacks: {
    /**
     * Block disabled accounts on every provider, and provision/normalise users
     * coming from OAuth.
     */
    async signIn({ user, account, profile }) {
      if (!user?.email) return false;

      if (account?.provider && account.provider !== "credentials") {
        const email = String(user.email).toLowerCase();
        const existing = await prisma.user.findUnique({ where: { email } });

        if (existing) {
          if (existing.status === false) return false;
          user.id = existing.id;
          user.role = existing.role;
          user.status = existing.status;
          return true;
        }

        // First OAuth login: create a CUSTOMER account without a password.
        const created = await prisma.user.create({
          data: {
            email,
            name: user.name || profile?.name || email.split("@")[0],
            role: ROLES.CUSTOMER,
            status: true,
          },
        });
        user.id = created.id;
        user.role = created.role;
        user.status = created.status;
        return true;
      }

      return user.status !== false;
    },

    async jwt({ token, user, trigger }) {
      // First sign-in: seed the token from the authenticated user object.
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role || ROLES.CUSTOMER;
        token.status = user.status !== false;
        token.refreshedAt = Date.now();
      }

      // Keep role/status fresh so admin changes take effect promptly, and honour
      // client-side `update()` calls from the profile page.
      const stale = !token.refreshedAt || Date.now() - token.refreshedAt > SESSION_REFRESH_MS;
      if (token.id && (stale || trigger === "update")) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { id: true, email: true, name: true, role: true, status: true },
        });

        if (!fresh || fresh.status === false) {
          // Account deleted or disabled mid-session -> force re-authentication.
          token.status = false;
          token.deleted = true;
        } else {
          token.id = fresh.id;
          token.email = fresh.email;
          token.name = fresh.name;
          token.role = fresh.role;
          token.status = true;
          token.refreshedAt = Date.now();
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.role = ROLE_VALUES.includes(token.role) ? token.role : ROLES.CUSTOMER;
        session.user.status = token.status !== false && !token.deleted;
      }
      return session;
    },
  },
};

export default authOptions;
