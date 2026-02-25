import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: true, note: "devtools placeholder" },
    {
      headers: { "content-type": "application/json; charset=utf-8" },
    }
  );
}
