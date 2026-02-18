import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABLES_TO_TRY = ["cases", "persons"] as const;

export async function GET() {
  try {
    const supabase = createServerClient();

    for (const table of TABLES_TO_TRY) {
      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (!error) {
        return NextResponse.json({
          ok: true,
          tableChecked: table,
          rowCount: count ?? 0,
        });
      }

      // Table doesn't exist — try next one
      if (error.code === "PGRST116" || error.code === "42P01") {
        continue;
      }

      // Some other Supabase/Postgres error
      return NextResponse.json(
        { ok: false, error: `${table}: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "No known table found (tried: " + TABLES_TO_TRY.join(", ") + ")" },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
