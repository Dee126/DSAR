import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || "test";
const COOKIE_NAME = "pp-auth-token";

/* ── NextAuth middleware (supabase mode) ─────────────────────────────── */

const nextAuthMiddleware = withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    secret: process.env.NEXTAUTH_SECRET,
    pages: { signIn: "/login" },
  },
);

/* ── HMAC verification (Edge-compatible Web Crypto) ──────────────────── */

function toBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode.apply(null, Array.from(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifyTokenEdge(token: string, secret: string): Promise<boolean> {
  const dot = token.indexOf(".");
  if (dot < 1) return false;

  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const expected = toBase64Url(new Uint8Array(sigBytes));

  if (sig !== expected) return false;

  // Check expiry
  try {
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (padded.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded + padding));
    return decoded.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/* ── Middleware entry point ───────────────────────────────────────────── */

export default async function middleware(request: NextRequest) {
  if (AUTH_MODE !== "test") {
    // Delegate to NextAuth middleware
    return (nextAuthMiddleware as unknown as (req: NextRequest) => Promise<NextResponse>)(request);
  }

  // Test mode: verify HMAC cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error("[middleware] AUTH_SECRET is not set");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const valid = await verifyTokenEdge(token, secret);
  if (!valid) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/cases/:path*",
    "/tasks/:path*",
    "/documents/:path*",
    "/settings/:path*",
    "/copilot/:path*",
    "/data-inventory/:path*",
    "/integrations/:path*",
    "/governance/:path*",
    "/incidents/:path*",
    "/vendors/:path*",
    "/executive/:path*",
    "/heatmap/:path*",
  ],
};
