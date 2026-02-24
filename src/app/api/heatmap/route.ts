import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmap → redirects to /api/heatmap/overview
 */
export async function GET(request: NextRequest) {
  const url = new URL("/api/heatmap/overview", request.nextUrl.origin);
  // Forward query params
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return NextResponse.redirect(url);
}
