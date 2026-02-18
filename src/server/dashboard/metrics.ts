import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DashboardMetricsParams {
  tenantId?: string;
  userIdOrEmail?: string;
  now?: Date;
}

export interface DashboardMetrics {
  totalCases: number;
  openCases: number;
  dueSoon: number;
  overdue: number;
  assignedToMe: number;
  recentCases: RecentCase[];
}

export interface RecentCase {
  id: string;
  caseNumber: string;
  status: string;
  type: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  description: string | null;
}

// Closed/terminal statuses — everything else counts as "open"
const TERMINAL_STATUSES = ["CLOSED", "REJECTED"] as const;

// Tables to try in order (Prisma @@map name first, then fallback)
const TABLE_CANDIDATES = ["dsar_cases", "cases"] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveTable(
  supabase: ReturnType<typeof createServerSupabase>
): Promise<string> {
  for (const table of TABLE_CANDIDATES) {
    const { error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .limit(0);

    if (!error) return table;

    // Table doesn't exist — try next candidate
    if (error.code === "PGRST116" || error.code === "42P01") continue;

    // Permission or other error on an existing table — still usable
    // (RLS might restrict rows, but table exists)
    if (error.code === "42501") return table;
  }

  throw new Error(
    `No usable table found. Tried: ${TABLE_CANDIDATES.join(", ")}`
  );
}

function isoDatePlusDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function getDashboardMetrics(
  params: DashboardMetricsParams = {}
): Promise<DashboardMetrics> {
  const { tenantId, userIdOrEmail, now = new Date() } = params;

  const supabase = createServerSupabase();
  const table = await resolveTable(supabase);

  const nowISO = now.toISOString();
  const dueSoonISO = isoDatePlusDays(now, 7);

  // Helper: build a query with shared base filters (tenant + not soft-deleted)
  function baseQuery() {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (tenantId) q = q.eq("tenantId", tenantId);
    q = q.is("deletedAt", null);
    return q;
  }

  // Run all count queries in parallel
  const [totalRes, openRes, dueSoonRes, overdueRes, assignedRes, recentRes] =
    await Promise.all([
      // 1. Total cases
      baseQuery(),

      // 2. Open cases (not in terminal status)
      baseQuery().not("status", "in", `(${TERMINAL_STATUSES.join(",")})`),

      // 3. Due soon: dueDate <= now+7d AND dueDate >= now AND not terminal
      baseQuery()
        .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
        .gte("dueDate", nowISO)
        .lte("dueDate", dueSoonISO),

      // 4. Overdue: dueDate < now AND not terminal
      baseQuery()
        .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
        .lt("dueDate", nowISO),

      // 5. Assigned to me (by userId; falls back gracefully)
      userIdOrEmail
        ? baseQuery()
            .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
            .eq("assignedToUserId", userIdOrEmail)
        : Promise.resolve({ count: 0, error: null }),

      // 6. Recent cases (last 10, full rows for the card list)
      (() => {
        let q = supabase
          .from(table)
          .select(
            "id, caseNumber, status, type, priority, dueDate, createdAt, description"
          )
          .is("deletedAt", null)
          .order("createdAt", { ascending: false })
          .limit(10);
        if (tenantId) q = q.eq("tenantId", tenantId);
        return q;
      })(),
    ]);

  // Log any errors server-side (never expose keys or internals)
  const errors: string[] = [];
  for (const [label, res] of [
    ["total", totalRes],
    ["open", openRes],
    ["dueSoon", dueSoonRes],
    ["overdue", overdueRes],
    ["assigned", assignedRes],
    ["recent", recentRes],
  ] as const) {
    if (res.error) {
      errors.push(`${label}: ${res.error.message} (${res.error.code})`);
    }
  }
  if (errors.length > 0) {
    console.warn("[dashboard/metrics] query warnings:", errors);
  }

  return {
    totalCases: totalRes.count ?? 0,
    openCases: openRes.count ?? 0,
    dueSoon: dueSoonRes.count ?? 0,
    overdue: overdueRes.count ?? 0,
    assignedToMe: ("count" in assignedRes ? assignedRes.count : 0) ?? 0,
    recentCases: (recentRes as { data: RecentCase[] | null }).data ?? [],
  };
}
