import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ name: "privacy-pilot", env: "dev" });
}
