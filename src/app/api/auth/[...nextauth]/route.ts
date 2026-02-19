export const dynamic = "force-dynamic";

// Auto-detect NEXTAUTH_URL on Vercel when not explicitly set.
// Without this, CSRF validation fails on Preview Deployments because
// NEXTAUTH_URL may point to the production domain while the browser
// is on a different *.vercel.app URL.
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
