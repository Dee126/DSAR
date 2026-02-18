-- ============================================================================
-- PrivacyPilot — Row Level Security (RLS)
-- ============================================================================
--
-- Sicherheitsmodell:
--
--   ┌─────────────────────────────────────────────────────────────────────┐
--   │  Browser  ──anon key──▸  Supabase  ──RLS──▸  DENY ALL (0 Rows)    │
--   │  API Route ─service role─▸  Supabase  ──bypasses RLS──▸  ✓ Daten  │
--   └─────────────────────────────────────────────────────────────────────┘
--
--   • Service Role Key (Next.js API routes): Umgeht RLS komplett.
--     Das ist der EINZIGE Datenpfad.  Kein Client-seitiger DB-Zugriff.
--
--   • Anon Key (Browser/createBrowserSupabase): RLS aktiv, KEINE
--     permissive Policies → 0 Zeilen.  Kein SELECT, kein INSERT,
--     kein UPDATE, kein DELETE.
--
--   • Authenticated (Supabase Auth, optional für Zukunft):
--     SELECT nur mit tenant_id = auth.jwt()->'tenant_id'.
--     Kein INSERT/UPDATE/DELETE.
--
-- Dieses Script ist idempotent (DROP IF EXISTS + CREATE OR REPLACE).
-- Einfach im Supabase SQL Editor ausführen.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1.  RLS AKTIVIEREN — alle Kern-Tabellen
-- ═══════════════════════════════════════════════════════════════════════════
-- ENABLE ist idempotent (kein Fehler wenn bereits aktiv).
-- Service Role Key umgeht RLS immer — API Routes sind nicht betroffen.

DO $$
DECLARE
  _tbl TEXT;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    -- Core DSAR
    'dsar_cases',
    'dsar_state_transitions',
    'dsar_incidents',
    'tasks',
    'documents',
    'comments',
    -- IAM + Tenant
    'tenants',
    'users',
    'data_subjects',
    -- Audit + Governance
    'audit_logs',
    'systems',
    'case_system_links',
    'communication_logs',
    -- SLA + Deadlines
    'case_deadlines',
    'case_milestones',
    'escalations',
    'notifications',
    -- Incidents
    'incidents',
    'incident_sources',
    'incident_systems',
    'incident_contacts',
    'incident_timelines',
    'incident_communications',
    'incident_assessments',
    'incident_regulator_records',
    -- Vendor
    'vendors',
    'vendor_contacts',
    'vendor_dpas',
    'vendor_requests',
    'vendor_request_items',
    'vendor_responses',
    -- Copilot
    'copilot_runs',
    'copilot_queries',
    'findings',
    -- IDV
    'idv_requests',
    'idv_artifacts',
    'idv_checks',
    'idv_decisions',
    -- Response
    'response_templates',
    'response_documents',
    'response_approvals',
    -- Executive KPI
    'privacy_kpi_snapshots',
    'executive_reports'
  ]
  LOOP
    -- Nur wenn Tabelle existiert (z.B. bei frischem Setup)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = _tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', _tbl);
    END IF;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2.  ALTE POLICIES AUFRÄUMEN (pp_* Namespace)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _pol RECORD;
BEGIN
  FOR _pol IN
    SELECT policyname, tablename
    FROM   pg_policies
    WHERE  policyname LIKE 'pp_%'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      _pol.policyname, _pol.tablename
    );
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3.  ANON-ROLLE: KEIN ZUGRIFF (implicit deny)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RLS ist aktiv, aber es gibt KEINE Policy für die anon-Rolle.
-- Ergebnis: jeder Query mit anon key liefert 0 Zeilen.
-- Das ist beabsichtigt — der Browser darf nicht direkt an die DB.
--
-- (Kein SQL nötig — die Abwesenheit einer Policy IS das Deny.)


-- ═══════════════════════════════════════════════════════════════════════════
-- 4.  AUTHENTICATED-ROLLE: TENANT-ISOLIERTER READ-ONLY
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Für die Zukunft (Supabase Auth / JWT-basiert):
--   • SELECT erlaubt, wenn tenantId im JWT == tenantId in der Zeile
--   • Kein INSERT/UPDATE/DELETE
--
-- JWT-Claim wird via auth.jwt()->>'tenant_id' gelesen.
-- Dafür muss beim Login der custom claim `tenant_id` ins JWT geschrieben
-- werden (z.B. via Supabase Auth Hook oder Database Function).
--
-- Bis dahin: auch authenticated bekommt 0 Zeilen, wenn kein JWT-Claim
-- gesetzt ist (COALESCE → '' matcht nie eine echte UUID).

-- ── Helper: Tenant-ID aus JWT extrahieren ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.pp_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Versuche custom claim (Supabase Auth Hook)
    auth.jwt()->>'tenant_id',
    -- Fallback: app_metadata (alternative Konvention)
    auth.jwt()->'app_metadata'->>'tenant_id',
    -- Kein Match → leerer String (matcht nie eine UUID)
    ''
  );
$$;


-- ── Macro: Policy für Tabelle mit "tenantId"-Spalte ─────────────────────

-- 4a. tenants — Sonderfall: id statt tenantId
CREATE POLICY pp_tenants_auth_select ON public."tenants"
  FOR SELECT
  TO authenticated
  USING ("id" = public.pp_tenant_id());

-- 4b. Alle Tabellen mit "tenantId" — tenant-scoped SELECT
DO $$
DECLARE
  _tbl TEXT;
  _extra_filter TEXT;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'users',
    'data_subjects',
    'dsar_cases',
    'dsar_state_transitions',
    'dsar_incidents',
    'tasks',
    'documents',
    'comments',
    'audit_logs',
    'systems',
    'case_system_links',
    'communication_logs',
    'case_deadlines',
    'case_milestones',
    'escalations',
    'notifications',
    'incidents',
    'incident_sources',
    'incident_systems',
    'incident_contacts',
    'incident_timelines',
    'incident_communications',
    'incident_assessments',
    'incident_regulator_records',
    'vendors',
    'vendor_contacts',
    'vendor_dpas',
    'vendor_requests',
    'vendor_request_items',
    'vendor_responses',
    'copilot_runs',
    'copilot_queries',
    'findings',
    'idv_requests',
    'idv_artifacts',
    'idv_checks',
    'idv_decisions',
    'response_templates',
    'response_documents',
    'response_approvals',
    'privacy_kpi_snapshots',
    'executive_reports'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = _tbl
    ) THEN
      CONTINUE;
    END IF;

    -- Soft-delete-Filter für Tabellen mit "deletedAt"
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = _tbl
        AND column_name = 'deletedAt'
    ) THEN
      _extra_filter := ' AND "deletedAt" IS NULL';
    ELSE
      _extra_filter := '';
    END IF;

    EXECUTE format(
      'CREATE POLICY pp_%I_auth_select ON public.%I '
      'FOR SELECT TO authenticated '
      'USING ("tenantId" = public.pp_tenant_id()%s)',
      _tbl, _tbl, _extra_filter
    );
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5.  DASHBOARD VIEWS (erben RLS der Basistabellen)
-- ═══════════════════════════════════════════════════════════════════════════
-- Views laufen mit den Rechten des Aufrufers (SECURITY INVOKER ist Default).
-- Anon → 0 Zeilen.  Service Role → alles.

DROP VIEW IF EXISTS public.dashboard_case_metrics;

CREATE VIEW public.dashboard_case_metrics AS
WITH base AS (
  SELECT
    "tenantId",
    "status",
    "dueDate",
    "assignedToUserId",
    "createdAt"
  FROM public."dsar_cases"
  WHERE "deletedAt" IS NULL
)
SELECT
  "tenantId",
  COUNT(*)::int                                                 AS "totalCases",
  COUNT(*) FILTER (WHERE "status" NOT IN ('CLOSED','REJECTED'))::int AS "openCases",
  COUNT(*) FILTER (
    WHERE "status" NOT IN ('CLOSED','REJECTED')
      AND "dueDate" >= NOW()
      AND "dueDate" <= NOW() + INTERVAL '7 days'
  )::int AS "dueSoon",
  COUNT(*) FILTER (
    WHERE "status" NOT IN ('CLOSED','REJECTED')
      AND "dueDate" < NOW()
  )::int AS "overdue",
  COUNT(*) FILTER (WHERE "status" = 'CLOSED')::int             AS "closedCases",
  COUNT(*) FILTER (WHERE "status" = 'REJECTED')::int           AS "rejectedCases",
  COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days')::int AS "newLast30d",
  COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days')::int  AS "newLast7d"
FROM base
GROUP BY "tenantId";

DROP VIEW IF EXISTS public.dashboard_assignee_metrics;

CREATE VIEW public.dashboard_assignee_metrics AS
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
FROM public."dsar_cases"
WHERE "deletedAt" IS NULL
  AND "assignedToUserId" IS NOT NULL
GROUP BY "tenantId", "assignedToUserId";

DROP VIEW IF EXISTS public.dashboard_status_distribution;

CREATE VIEW public.dashboard_status_distribution AS
SELECT
  "tenantId",
  "status",
  COUNT(*)::int AS "count"
FROM public."dsar_cases"
WHERE "deletedAt" IS NULL
GROUP BY "tenantId", "status"
ORDER BY "tenantId", "count" DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6.  VERIFIKATION
-- ═══════════════════════════════════════════════════════════════════════════

-- 6a. RLS aktiv auf Kern-Tabellen?
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'dsar_cases', 'dsar_incidents', 'dsar_state_transitions',
    'tasks', 'documents', 'users', 'tenants'
  )
ORDER BY tablename;

-- 6b. Policies auflisten
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  LEFT(qual::text, 80) AS using_clause
FROM pg_policies
WHERE policyname LIKE 'pp_%'
ORDER BY tablename, policyname;

-- 6c. Sicherheitscheck: keine USING(true) Policies?
SELECT tablename, policyname, qual
FROM pg_policies
WHERE policyname LIKE 'pp_%'
  AND qual::text = 'true';
-- Erwartetes Ergebnis: 0 Zeilen
