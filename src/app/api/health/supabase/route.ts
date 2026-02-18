import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerSupabase();

    // 1. Check base table
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

    // 2. Check view (non-fatal — view may not be deployed yet)
    const { error: viewError, count: viewCount } = await supabase
      .from("v_dsar_cases_current_state")
      .select("case_id", { count: "exact", head: true });

    return NextResponse.json({
      ok: true,
      table: "dsar_cases",
      rowCount: count ?? data?.length ?? 0,
      view: {
        name: "v_dsar_cases_current_state",
        ok: !viewError,
        rowCount: viewCount ?? 0,
        ...(viewError ? { error: viewError.message } : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
