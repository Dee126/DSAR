import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DashboardMetricsParams {
  tenantId?: string;
  userId?: string;
  now?: Date;
}

export interface RecentCase {
  id: string;
  caseNumber: string;
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

// ─── Supabase helpers ───────────────────────────────────────────────────────

// Re-export from the canonical module to avoid duplicating the check
import { isServerSupabaseConfigured as isSupabaseConfigured } from "@/lib/supabase/server";

function isoDatePlusDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── Prisma-based fallback ──────────────────────────────────────────────────

async function getDashboardMetricsViaPrisma(
  params: DashboardMetricsParams
): Promise<DashboardMetrics> {
  const { tenantId, userId, now = new Date() } = params;
  const warnings: string[] = [
    "Supabase not configured — using Prisma fallback",
  ];

  const dueSoonDate = new Date(now);
  dueSoonDate.setDate(dueSoonDate.getDate() + 7);

  // Base where clause: tenant isolation + not soft-deleted
  const baseWhere: Prisma.DSARCaseWhereInput = {
    ...(tenantId ? { tenantId } : {}),
    deletedAt: null,
  };

  const openWhere: Prisma.DSARCaseWhereInput = {
    ...baseWhere,
    status: { notIn: [...TERMINAL_STATUSES] },
  };

  // Fire all count queries in parallel
  const [
    totalCases,
    openCases,
    dueSoon,
    overdue,
    assignedToMe,
    incidentLinkedCases,
    recentRaw,
  ] = await Promise.all([
    // 1. totalCases
    prisma.dSARCase.count({ where: baseWhere }),

    // 2. openCases
    prisma.dSARCase.count({ where: openWhere }),

    // 3. dueSoon: due within 7 days AND not terminal
    prisma.dSARCase.count({
      where: {
        ...openWhere,
        dueDate: { gte: now, lte: dueSoonDate },
      },
    }),

    // 4. overdue: due < now AND not terminal
    prisma.dSARCase.count({
      where: {
        ...openWhere,
        dueDate: { lt: now },
      },
    }),

    // 5. assignedToMe
    userId
      ? prisma.dSARCase.count({
          where: {
            ...openWhere,
            assignedToUserId: userId,
          },
        })
      : Promise.resolve(0),

    // 6. incidentLinkedCases
    prisma.dsarIncident
      .groupBy({
        by: ["caseId"],
        where: tenantId ? { tenantId } : {},
      })
      .then((groups) => groups.length)
      .catch(() => {
        warnings.push("dsar_incidents query failed");
        return 0;
      }),

    // 7. recentCases (last 10)
    prisma.dSARCase.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        dueDate: true,
        createdAt: true,
        description: true,
        dataSubject: { select: { fullName: true } },
      },
    }),
  ]);

  // Map recent cases to uniform shape
  const recentCases: RecentCase[] = recentRaw.map((c) => ({
    id: c.id,
    caseNumber: c.caseNumber,
    subject: c.dataSubject?.fullName ?? c.description ?? null,
    current_state: c.status,
    due_at: c.dueDate?.toISOString() ?? null,
    created_at: c.createdAt.toISOString(),
  }));

  return {
    totalCases,
    openCases,
    dueSoon,
    overdue,
    assignedToMe,
    incidentLinkedCases,
    incidentLinkedSupported: true,
    recentCases,
    _warnings: warnings,
  };
}

// ─── Supabase-based (original) ─────────────────────────────────────────────

async function getDashboardMetricsViaSupabase(
  params: DashboardMetricsParams
): Promise<DashboardMetrics> {
  // Lazy import so missing env vars don't crash at module load
  const { createServerSupabase } = await import("@/lib/supabase/server");

  const { tenantId, userId, now = new Date() } = params;
  const warnings: string[] = [];

  const maybeSupabase = createServerSupabase();

  if (!maybeSupabase) {
    throw new Error("Supabase client could not be created (missing env vars)");
  }

  // TypeScript narrows: non-null after the guard above
  const supabase = maybeSupabase;

  type SupabaseClient = typeof supabase;

  async function tableExists(
    sb: SupabaseClient,
    name: string
  ): Promise<boolean> {
    const { error } = await sb
      .from(name)
      .select("*", { count: "exact", head: true })
      .limit(0);
    return !error;
  }

  const nowISO = now.toISOString();
  const dueSoonISO = isoDatePlusDays(now, 7);

  // 1. Decide data source
  const hasView = await tableExists(supabase, "v_dsar_cases_current_state");
  const hasTable = await tableExists(supabase, "dsar_cases");

  if (!hasView && !hasTable) {
    throw new Error(
      "Neither v_dsar_cases_current_state nor dsar_cases found"
    );
  }

  const useView = hasView;
  const source = useView ? "v_dsar_cases_current_state" : "dsar_cases";

  const col = useView
    ? {
        id: "case_id",
        state: "current_state",
        dueDate: "due_at",
        assignedTo: "assigned_to",
        tenantId: "tenant_id",
        deletedAt: null as string | null,
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

  // 2. Count query helpers
  function baseCountQuery() {
    let q = supabase
      .from(source)
      .select("*", { count: "exact", head: true });
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

  // 3. Incident probe
  const hasIncidents = await tableExists(supabase, "dsar_incidents");

  // 4. Parallel queries
  const [
    totalRes,
    openRes,
    dueSoonRes,
    overdueRes,
    assignedRes,
    incidentRes,
    recentRes,
  ] = await Promise.all([
    baseCountQuery(),
    openFilter(baseCountQuery()),
    openFilter(baseCountQuery())
      .gte(col.dueDate, nowISO)
      .lte(col.dueDate, dueSoonISO),
    openFilter(baseCountQuery()).lt(col.dueDate, nowISO),
    userId
      ? openFilter(baseCountQuery()).eq(col.assignedTo, userId)
      : Promise.resolve({ count: 0, error: null }),
    hasIncidents
      ? (() => {
          let q = supabase
            .from("dsar_incidents")
            .select("caseId", { count: "exact", head: true });
          if (tenantId) q = q.eq("tenantId", tenantId);
          return q;
        })()
      : Promise.resolve({ count: 0, error: null }),
    (() => {
      const fields = useView
        ? "case_id, case_number, subject, current_state, due_at, state_changed_at"
        : "id, caseNumber, status, dueDate, createdAt, description";

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

  // 5. Warnings
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
    warnings.push(
      "dsar_incidents table not found — incidentLinkedCases = 0"
    );
  }

  // 6. Map recent cases
  type RawRow = Record<string, unknown>;
  const rawRecent: RawRow[] =
    (recentRes as { data: RawRow[] | null }).data ?? [];

  const recentCases: RecentCase[] = rawRecent.map((row) => ({
    id: String(row[col.id] ?? ""),
    caseNumber: String(
      useView ? row["case_number"] ?? "" : row["caseNumber"] ?? ""
    ),
    subject: useView
      ? (row["subject"] as string | null) ?? null
      : (row["description"] as string | null) ?? null,
    current_state: String(row[col.state] ?? "UNKNOWN"),
    due_at: row[col.dueDate] ? String(row[col.dueDate]) : null,
    created_at: String(row[col.createdAt] ?? ""),
  }));

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

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getDashboardMetrics(
  params: DashboardMetricsParams = {}
): Promise<DashboardMetrics> {
  if (isSupabaseConfigured()) {
    try {
      return await getDashboardMetricsViaSupabase(params);
    } catch (err) {
      console.warn(
        LOG_PREFIX,
        "Supabase query failed, falling back to Prisma:",
        err instanceof Error ? err.message : err
      );
      // Fall through to Prisma
    }
  }

  return getDashboardMetricsViaPrisma(params);
}
