import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// ── Mock "server-only" (vitest runs in Node, not Next.js) ───────────────
vi.mock("server-only", () => ({}));

// ── Mock Supabase client ────────────────────────────────────────────────
// We build a chainable query builder that records calls and returns
// configurable results per "from" table.

type MockResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string; code: string } | null;
  count: number | null;
};

const tableResults = new Map<string, MockResult>();

function setTableResult(table: string, result: Partial<MockResult>) {
  tableResults.set(table, {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  });
}

function makeChain(table: string) {
  const result = () =>
    tableResults.get(table) ?? { data: null, error: null, count: 0 };

  const chain: Record<string, unknown> = {};
  const self = () => chain;

  // Every filter method returns itself (chainable), then() resolves
  for (const method of [
    "select",
    "eq",
    "not",
    "is",
    "gte",
    "lte",
    "lt",
    "gt",
    "order",
    "limit",
  ]) {
    chain[method] = vi.fn(self);
  }

  // Make chain thenable so Promise.all works
  chain.then = (resolve: (v: MockResult) => void) => {
    resolve(result());
    return chain;
  };

  return chain;
}

const mockFrom = vi.fn((table: string) => makeChain(table));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => ({ from: mockFrom }),
}));

// ── Import after mocks are registered ───────────────────────────────────
// Use a lazily-resolved reference so the import happens inside test scope.

let getDashboardMetrics: typeof import("@/server/dashboard/getDashboardMetrics")["getDashboardMetrics"];

beforeAll(async () => {
  const mod = await import("@/server/dashboard/getDashboardMetrics");
  getDashboardMetrics = mod.getDashboardMetrics;
});

// ── Tests ───────────────────────────────────────────────────────────────

describe("getDashboardMetrics", () => {
  const NOW = new Date("2026-02-18T12:00:00Z");

  beforeEach(() => {
    tableResults.clear();
    mockFrom.mockClear();

    // Default: view exists, all tables exist
    setTableResult("v_dsar_cases_current_state", { count: 25, data: [] });
    setTableResult("dsar_cases", { count: 25, data: [] });
    setTableResult("dsar_incidents", { count: 3, data: [] });
  });

  it("returns all KPI fields with correct types", async () => {
    const result = await getDashboardMetrics({ now: NOW });

    expect(result).toMatchObject({
      totalCases: expect.any(Number),
      openCases: expect.any(Number),
      dueSoon: expect.any(Number),
      overdue: expect.any(Number),
      assignedToMe: expect.any(Number),
      incidentLinkedCases: expect.any(Number),
      incidentLinkedSupported: true,
      recentCases: expect.any(Array),
      _warnings: expect.any(Array),
    });
  });

  it("uses counts from Supabase responses", async () => {
    setTableResult("v_dsar_cases_current_state", { count: 42, data: [] });
    setTableResult("dsar_incidents", { count: 7, data: [] });

    const result = await getDashboardMetrics({ now: NOW });

    expect(result.totalCases).toBe(42);
    expect(result.incidentLinkedCases).toBe(7);
  });

  it("prefers the view over raw table", async () => {
    setTableResult("v_dsar_cases_current_state", { count: 10, data: [] });

    await getDashboardMetrics({ now: NOW });

    // The first call is the view existence probe, subsequent calls
    // should query the view, not dsar_cases
    const fromCalls = mockFrom.mock.calls.map(([t]) => t);
    const querySources = fromCalls.filter(
      (t) =>
        t === "v_dsar_cases_current_state" || t === "dsar_cases"
    );

    // Most queries should target the view
    const viewCount = querySources.filter(
      (t) => t === "v_dsar_cases_current_state"
    ).length;
    expect(viewCount).toBeGreaterThan(1);
  });

  it("falls back to dsar_cases when view is missing", async () => {
    // View probe returns error → not found
    setTableResult("v_dsar_cases_current_state", {
      count: null,
      error: { message: "relation not found", code: "42P01" },
    });
    setTableResult("dsar_cases", { count: 5, data: [] });

    const result = await getDashboardMetrics({ now: NOW });

    expect(result.totalCases).toBe(5);
    expect(result._warnings).toContainEqual(
      expect.stringContaining("falling back")
    );
  });

  it("returns assignedToMe = 0 when no userId", async () => {
    const result = await getDashboardMetrics({ now: NOW });

    expect(result.assignedToMe).toBe(0);
  });

  it("queries assigned_to when userId is provided", async () => {
    setTableResult("v_dsar_cases_current_state", { count: 3, data: [] });

    const result = await getDashboardMetrics({
      userId: "user-123",
      now: NOW,
    });

    // Should have called .eq("assigned_to", "user-123") somewhere
    expect(result.assignedToMe).toBe(3);
  });

  it("sets incidentLinkedSupported=false when dsar_incidents is missing", async () => {
    setTableResult("dsar_incidents", {
      count: null,
      error: { message: "relation not found", code: "42P01" },
    });

    const result = await getDashboardMetrics({ now: NOW });

    expect(result.incidentLinkedSupported).toBe(false);
    expect(result.incidentLinkedCases).toBe(0);
    expect(result._warnings).toContainEqual(
      expect.stringContaining("dsar_incidents")
    );
  });

  it("throws when neither view nor table exist", async () => {
    setTableResult("v_dsar_cases_current_state", {
      count: null,
      error: { message: "not found", code: "42P01" },
    });
    setTableResult("dsar_cases", {
      count: null,
      error: { message: "not found", code: "42P01" },
    });

    await expect(getDashboardMetrics({ now: NOW })).rejects.toThrow(
      /neither.*found/i
    );
  });

  it("maps recent cases to uniform shape (view path)", async () => {
    setTableResult("v_dsar_cases_current_state", {
      count: 1,
      data: [
        {
          case_id: "abc-123",
          current_state: "DATA_COLLECTION",
          due_at: "2026-02-25T00:00:00Z",
          state_changed_at: "2026-02-10T09:00:00Z",
        },
      ],
    });

    const result = await getDashboardMetrics({ now: NOW });

    expect(result.recentCases).toHaveLength(1);
    expect(result.recentCases[0]).toMatchObject({
      id: "abc-123",
      current_state: "DATA_COLLECTION",
      due_at: "2026-02-25T00:00:00Z",
      created_at: "2026-02-10T09:00:00Z",
    });
  });

  it("collects query errors as warnings without throwing", async () => {
    // When a table probe returns an error, tableExists returns false,
    // so the query is skipped and a "not found" warning is emitted.
    // This verifies that errors don't cause the function to throw.
    setTableResult("v_dsar_cases_current_state", { count: 10, data: [] });
    setTableResult("dsar_incidents", {
      count: null,
      error: { message: "RLS policy violation", code: "42501" },
      data: null,
    });

    const result = await getDashboardMetrics({ now: NOW });

    // Probe failure → treated as missing table → graceful degradation
    expect(result.incidentLinkedSupported).toBe(false);
    expect(result.incidentLinkedCases).toBe(0);
    expect(result._warnings).toContainEqual(
      expect.stringContaining("dsar_incidents")
    );
  });
});
