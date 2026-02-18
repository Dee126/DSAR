-- ============================================================================
-- PrivacyPilot — Supabase RLS Policies & Dashboard View
-- ============================================================================
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL).
--
-- Architecture:
--   • Service Role Key (server-side API routes) bypasses RLS entirely.
--     This is the PRIMARY data path — all Next.js API routes use it.
--   • Anon Key (browser client) is subject to RLS.
--     Policies below allow read-only access scoped to the demo tenant.
--
-- Tenant ID (from seed migration):
--   00000000-0000-4000-8000-000000000001  ("Acme Corp")
-- ============================================================================

-- ─── 1. Enable RLS on all core tables ──────────────────────────────────────
-- RLS must be enabled for policies to take effect.
-- Service Role Key always bypasses RLS, so server-side routes are unaffected.

ALTER TABLE "tenants"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_subjects"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dsar_cases"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dsar_state_transitions"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "systems"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_system_links"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_logs"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_deadlines"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_milestones"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "escalations"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"           ENABLE ROW LEVEL SECURITY;


-- ─── 2. Drop existing policies (idempotent re-run) ────────────────────────

DO $$ DECLARE
  _pol RECORD;
BEGIN
  FOR _pol IN
    SELECT policyname, tablename
    FROM   pg_policies
    WHERE  policyname LIKE 'pp_%'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      _pol.policyname, _pol.tablename
    );
  END LOOP;
END $$;


-- ─── 3. Tenant-scoped READ policies (anon + authenticated) ────────────────
-- ⚠️  DEMO-ONLY: Hard-coded tenant ID for single-tenant demo.
-- In production, replace with auth.jwt()->'tenantId' or a lookup.
-- All policies are SELECT-only. No INSERT/UPDATE/DELETE via anon key.

-- Helper: fixed demo tenant ID
DO $$ BEGIN
  PERFORM set_config('app.demo_tenant_id',
    '00000000-0000-4000-8000-000000000001', false);
END $$;


-- 3a. tenants — only the demo tenant row
CREATE POLICY pp_tenants_select ON "tenants"
  FOR SELECT
  USING ("id" = '00000000-0000-4000-8000-000000000001');


-- 3b. Tables with "tenantId" column — tenant-scoped SELECT
-- Pattern: anon/authenticated can read rows where tenantId = demo tenant.

CREATE POLICY pp_users_select ON "users"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_data_subjects_select ON "data_subjects"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_dsar_cases_select ON "dsar_cases"
  FOR SELECT
  USING (
    "tenantId" = '00000000-0000-4000-8000-000000000001'
    AND "deletedAt" IS NULL
  );

CREATE POLICY pp_dsar_transitions_select ON "dsar_state_transitions"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_tasks_select ON "tasks"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_documents_select ON "documents"
  FOR SELECT
  USING (
    "tenantId" = '00000000-0000-4000-8000-000000000001'
    AND "deletedAt" IS NULL
  );

CREATE POLICY pp_comments_select ON "comments"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_audit_logs_select ON "audit_logs"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_systems_select ON "systems"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_case_system_links_select ON "case_system_links"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_communication_logs_select ON "communication_logs"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_case_deadlines_select ON "case_deadlines"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_case_milestones_select ON "case_milestones"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_escalations_select ON "escalations"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');

CREATE POLICY pp_notifications_select ON "notifications"
  FOR SELECT
  USING ("tenantId" = '00000000-0000-4000-8000-000000000001');


-- ─── 4. Explicit DENY for writes via anon key ─────────────────────────────
-- RLS with no INSERT/UPDATE/DELETE policy = implicit deny.
-- No write policies are created, so anon key cannot mutate data.
-- Service Role bypasses RLS and can still write via API routes.


-- ─── 5. Dashboard Metrics View ─────────────────────────────────────────────
-- Materialized-like computed view for dashboard KPIs.
-- Queryable via: supabase.from('dashboard_case_metrics').select('*')
-- Note: views inherit the RLS of the underlying tables, so anon key
-- will only see data for the demo tenant.

DROP VIEW IF EXISTS dashboard_case_metrics;

CREATE VIEW dashboard_case_metrics AS
WITH base AS (
  SELECT
    "tenantId",
    "status",
    "dueDate",
    "assignedToUserId",
    "createdAt"
  FROM "dsar_cases"
  WHERE "deletedAt" IS NULL
),
counts AS (
  SELECT
    "tenantId",

    COUNT(*)::int AS "totalCases",

    COUNT(*) FILTER (
      WHERE "status" NOT IN ('CLOSED', 'REJECTED')
    )::int AS "openCases",

    COUNT(*) FILTER (
      WHERE "status" NOT IN ('CLOSED', 'REJECTED')
        AND "dueDate" >= NOW()
        AND "dueDate" <= NOW() + INTERVAL '7 days'
    )::int AS "dueSoon",

    COUNT(*) FILTER (
      WHERE "status" NOT IN ('CLOSED', 'REJECTED')
        AND "dueDate" < NOW()
    )::int AS "overdue",

    COUNT(*) FILTER (
      WHERE "status" = 'CLOSED'
    )::int AS "closedCases",

    COUNT(*) FILTER (
      WHERE "status" = 'REJECTED'
    )::int AS "rejectedCases",

    COUNT(*) FILTER (
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
    )::int AS "newLast30d",

    COUNT(*) FILTER (
      WHERE "createdAt" >= NOW() - INTERVAL '7 days'
    )::int AS "newLast7d"

  FROM base
  GROUP BY "tenantId"
)
SELECT
  c."tenantId",
  c."totalCases",
  c."openCases",
  c."dueSoon",
  c."overdue",
  c."closedCases",
  c."rejectedCases",
  c."newLast30d",
  c."newLast7d",
  t."name" AS "tenantName"
FROM counts c
LEFT JOIN "tenants" t ON t."id" = c."tenantId";


-- ─── 6. Per-assignee metrics (for "Assigned to Me" card) ──────────────────

DROP VIEW IF EXISTS dashboard_assignee_metrics;

CREATE VIEW dashboard_assignee_metrics AS
SELECT
  "tenantId",
  "assignedToUserId",
  COUNT(*)::int AS "totalAssigned",
  COUNT(*) FILTER (
    WHERE "status" NOT IN ('CLOSED', 'REJECTED')
  )::int AS "openAssigned",
  COUNT(*) FILTER (
    WHERE "status" NOT IN ('CLOSED', 'REJECTED')
      AND "dueDate" < NOW()
  )::int AS "overdueAssigned"
FROM "dsar_cases"
WHERE "deletedAt" IS NULL
  AND "assignedToUserId" IS NOT NULL
GROUP BY "tenantId", "assignedToUserId";


-- ─── 7. Status distribution view (for charts) ─────────────────────────────

DROP VIEW IF EXISTS dashboard_status_distribution;

CREATE VIEW dashboard_status_distribution AS
SELECT
  "tenantId",
  "status",
  COUNT(*)::int AS "count"
FROM "dsar_cases"
WHERE "deletedAt" IS NULL
GROUP BY "tenantId", "status"
ORDER BY "tenantId", "count" DESC;


-- ─── 8. Verification ──────────────────────────────────────────────────────

-- Check RLS is enabled on core tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tenants', 'users', 'data_subjects', 'dsar_cases',
    'tasks', 'documents', 'comments', 'audit_logs'
  )
ORDER BY tablename;

-- Check policies exist
SELECT
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE policyname LIKE 'pp_%'
ORDER BY tablename, policyname;

-- Quick test: metrics for demo tenant
SELECT * FROM dashboard_case_metrics
WHERE "tenantId" = '00000000-0000-4000-8000-000000000001';
