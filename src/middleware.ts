import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    // Explicitly pass the secret so the Edge Runtime can verify JWTs
    // even if the NEXTAUTH_SECRET env var isn't picked up automatically.
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
      signIn: "/login",
    },
  }
);

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
  ],
};
