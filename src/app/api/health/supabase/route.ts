import { NextResponse } from "next/server";
import { createServerSupabase, isServerSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // ── 0. Env-var check ───────────────────────────────────────────
    const envStatus = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    if (!isServerSupabaseConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase not configured (missing env vars)",
          envVars: envStatus,
        },
        { status: 503 }
      );
    }

    const supabase = createServerSupabase()!;

    // ── 1. Connectivity ping (no table dependency) ─────────────────
    // Uses a lightweight RPC-style query to verify the connection works.
    // `from` on a non-existent table would fail, so we use the
    // PostgREST root endpoint via a trivial auth.getUser() call.
    const { data: userData, error: authError } = await supabase.auth.getUser();
    const connected = !authError || authError.message?.includes("not authenticated");
    // service-role key always returns a user or a clear error —
    // a network / URL issue would throw or return a different error.

    if (!connected) {
      return NextResponse.json(
        {
          ok: false,
          error: `Connection failed: ${authError?.message}`,
          envVars: envStatus,
        },
        { status: 500 }
      );
    }

    // ── 2. Check base table (may not exist yet) ────────────────────
    const { data, error, count } = await supabase
      .from("dsar_cases")
      .select("id", { count: "exact", head: false })
      .limit(1);

    const tableExists = !error || !error.message?.includes("does not exist");

    // ── 3. Check view (non-fatal) ──────────────────────────────────
    const { error: viewError, count: viewCount } = await supabase
      .from("v_dsar_cases_current_state")
      .select("case_id", { count: "exact", head: true });

    return NextResponse.json({
      ok: true,
      connected: true,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      envVars: envStatus,
      table: {
        name: "dsar_cases",
        exists: tableExists,
        rowCount: count ?? data?.length ?? 0,
        ...(error ? { error: error.message } : {}),
      },
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
