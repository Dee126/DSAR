import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerSupabase();

    const { data, error, count } = await supabase
      .from("dsar_cases")
      .select("id", { count: "exact", head: false })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, table: "dsar_cases", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      table: "dsar_cases",
      rowCount: count ?? data?.length ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
