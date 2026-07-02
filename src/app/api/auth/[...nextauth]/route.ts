import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";

/**
 * NextAuth v4 App Router catch-all handler (T086, plan §7). `NextAuth(authOptions)`
 * returns a single handler that serves every `/api/auth/*` endpoint (signin,
 * callback, session, csrf, signout); it is exported as both GET and POST per the
 * official v4 App Router pattern.
 *
 * NextAuth's core relies on Node's crypto — pin the Node.js runtime (not Edge).
 */
export const runtime = "nodejs";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
