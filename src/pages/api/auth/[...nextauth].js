import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

/**
 * NextAuth catch-all route: handles /api/auth/signin, /signout, /session,
 * /csrf, /providers and the credentials callback.
 *
 * The options live in src/lib/authOptions.js so that every other API route can
 * verify sessions with getServerSession(req, res, authOptions).
 */
export default NextAuth(authOptions);
