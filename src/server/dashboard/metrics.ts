import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DashboardMetricsParams {
  tenantId?: string;
  userId?: string;
  now?: Date;
}

export interface RecentCase {
  id: string;
  subject?: string | null;
  current_state: string;
  due_at?: string | null;
  created_at: string;
}

export interface DashboardMetrics {
  totalCases: number;
  openCases: number;
  dueSoon: number;
  overdue: number;
  assignedToMe: number;
  incidentLinkedCases: number;
  incidentLinkedSupported: boolean;
  recentCases: RecentCase[];
  _warnings: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TERMINAL_STATUSES = ["CLOSED", "REJECTED"] as const;

const LOG_PREFIX = "[dashboard/metrics]";

// ─── Helpers ────────────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createServerSupabase>;

/**
 * Probe whether a table/view exists by running a cheap head query.
 * Returns true if the table is queryable, false otherwise.
 */
async function tableExists(
  supabase: SupabaseClient,
  name: string
): Promise<boolean> {
  const { error } = await supabase
    .from(name)
    .select("*", { count: "exact", head: true })
    .limit(0);
  return !error;
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
  const { tenantId, userId, now = new Date() } = params;
  const warnings: string[] = [];

  const supabase = createServerSupabase();

  const nowISO = now.toISOString();
  const dueSoonISO = isoDatePlusDays(now, 7);

  // ── 1. Decide data source: view (preferred) vs. raw table ─────────────

  const hasView = await tableExists(supabase, "v_dsar_cases_current_state");
  const hasTable = await tableExists(supabase, "dsar_cases");

  if (!hasView && !hasTable) {
    throw new Error("Neither v_dsar_cases_current_state nor dsar_cases found");
  }

  // Column name mapping depending on data source
  const useView = hasView;
  const source = useView ? "v_dsar_cases_current_state" : "dsar_cases";

  // The view uses snake_case aliases; the raw table uses Prisma camelCase.
  const col = useView
    ? {
        id: "case_id",
        state: "current_state",
        dueDate: "due_at",
        assignedTo: "assigned_to",
        tenantId: "tenant_id",
        deletedAt: null as string | null, // view already filters soft-deletes
        createdAt: "state_changed_at",
      }
    : {
        id: "id",
        state: "status",
        dueDate: "dueDate",
        assignedTo: "assignedToUserId",
        tenantId: "tenantId",
        deletedAt: "deletedAt" as string | null,
        createdAt: "createdAt",
      };

  if (!hasView) {
    warnings.push(
      "v_dsar_cases_current_state not found — falling back to dsar_cases.status"
    );
  }

  // ── 2. Build count queries in parallel ────────────────────────────────

  function baseCountQuery() {
    let q = supabase.from(source).select("*", { count: "exact", head: true });
    if (tenantId) q = q.eq(col.tenantId, tenantId);
    if (col.deletedAt) q = q.is(col.deletedAt, null);
    return q;
  }

  function openFilter(
    q: ReturnType<typeof baseCountQuery>
  ): ReturnType<typeof baseCountQuery> {
    return q.not(
      col.state,
      "in",
      `(${TERMINAL_STATUSES.join(",")})`
    );
  }

  // ── 3. Incident-linked cases probe ────────────────────────────────────

  const hasIncidents = await tableExists(supabase, "dsar_incidents");

  // ── 4. Fire all count queries in parallel ─────────────────────────────

  const [
    totalRes,
    openRes,
    dueSoonRes,
    overdueRes,
    assignedRes,
    incidentRes,
    recentRes,
  ] = await Promise.all([
    // 1. totalCases
    baseCountQuery(),

    // 2. openCases
    openFilter(baseCountQuery()),

    // 3. dueSoon: due within 7 days AND not terminal
    openFilter(baseCountQuery())
      .gte(col.dueDate, nowISO)
      .lte(col.dueDate, dueSoonISO),

    // 4. overdue: due_at < now AND not terminal
    openFilter(baseCountQuery()).lt(col.dueDate, nowISO),

    // 5. assignedToMe
    userId
      ? openFilter(baseCountQuery()).eq(col.assignedTo, userId)
      : Promise.resolve({ count: 0, error: null }),

    // 6. incidentLinkedCases (distinct caseId count)
    hasIncidents
      ? (() => {
          let q = supabase
            .from("dsar_incidents")
            .select("caseId", { count: "exact", head: true });
          if (tenantId) q = q.eq("tenantId", tenantId);
          return q;
        })()
      : Promise.resolve({ count: 0, error: null }),

    // 7. recentCases (last 10, full rows)
    (() => {
      const fields = useView
        ? "case_id, current_state, due_at, state_changed_at"
        : "id, status, dueDate, createdAt, description";

      let q = supabase
        .from(source)
        .select(fields)
        .order(col.createdAt, { ascending: false })
        .limit(10);
      if (tenantId) q = q.eq(col.tenantId, tenantId);
      if (col.deletedAt) q = q.is(col.deletedAt, null);
      return q;
    })(),
  ]);

  // ── 5. Collect server-side warnings ───────────────────────────────────

  const queryResults = [
    ["totalCases", totalRes],
    ["openCases", openRes],
    ["dueSoon", dueSoonRes],
    ["overdue", overdueRes],
    ["assignedToMe", assignedRes],
    ["incidentLinked", incidentRes],
    ["recentCases", recentRes],
  ] as const;

  for (const [label, res] of queryResults) {
    if (res.error) {
      const msg = `${label}: ${res.error.message} (${res.error.code})`;
      console.warn(LOG_PREFIX, msg);
      warnings.push(msg);
    }
  }

  if (!hasIncidents) {
    warnings.push("dsar_incidents table not found — incidentLinkedCases = 0");
  }

  // ── 6. Map recent cases to uniform shape ──────────────────────────────

  type RawRow = Record<string, unknown>;
  const rawRecent: RawRow[] =
    (recentRes as { data: RawRow[] | null }).data ?? [];

  const recentCases: RecentCase[] = rawRecent.map((row) => ({
    id: String(row[col.id] ?? ""),
    subject: useView ? null : (row["description"] as string | null) ?? null,
    current_state: String(row[col.state] ?? "UNKNOWN"),
    due_at: row[col.dueDate] ? String(row[col.dueDate]) : null,
    created_at: String(row[col.createdAt] ?? ""),
  }));

  // ── 7. Assemble response ──────────────────────────────────────────────

  return {
    totalCases: totalRes.count ?? 0,
    openCases: openRes.count ?? 0,
    dueSoon: dueSoonRes.count ?? 0,
    overdue: overdueRes.count ?? 0,
    assignedToMe: ("count" in assignedRes ? assignedRes.count : 0) ?? 0,
    incidentLinkedCases: incidentRes.count ?? 0,
    incidentLinkedSupported: hasIncidents,
    recentCases,
    _warnings: warnings,
  };
}
