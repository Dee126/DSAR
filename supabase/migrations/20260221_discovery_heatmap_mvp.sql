-- ============================================================================
-- Migration: Discovery & Heatmap MVP
-- Date: 2026-02-21
-- ============================================================================
--
-- New tables for the PII discovery and heatmap feature:
--   - data_assets        (files, records, mailboxes discovered in connected systems)
--   - discovery_findings  (PII detections within data assets)
--   - scan_jobs           (background scan runs per system)
--   - dsar_case_items     (links DSAR cases to specific data assets)
--
-- Also adds a "type" column to the existing Prisma-managed "systems" table.
--
-- NOTE: The table is named "discovery_findings" (not "findings") to avoid
-- conflict with the existing Prisma-managed "findings" table used by the
-- Copilot AI feature.
--
-- Tenant isolation:
--   - All tables include a nullable tenant_id column (prepared for multi-tenant)
--   - RLS is enabled; MVP policies grant authenticated users full access
--   - Service-role key (used by Next.js API routes) bypasses RLS entirely
--
-- Idempotent: safe to re-run (IF NOT EXISTS / IF NOT EXISTS checks).
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1.  EXTEND EXISTING "systems" TABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- Add a human-readable type tag (e.g. 'cloud_saas', 'on_premise', 'database').
-- The existing Prisma model does not declare this column, but Prisma ignores
-- columns it doesn't know about, so this is safe.

ALTER TABLE public."systems"
  ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'other';

COMMENT ON COLUMN public."systems"."type" IS
  'System type tag for discovery grouping (cloud_saas, on_premise, database, etc.)';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2.  data_assets
-- ═══════════════════════════════════════════════════════════════════════════
-- Represents a discoverable data object within a system: a file, mailbox,
-- database table, calendar, contact list, etc.

CREATE TABLE IF NOT EXISTS public.data_assets (
  id            text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     text,                                                       -- nullable for MVP
  system_id     text        NOT NULL REFERENCES public."systems"(id) ON DELETE CASCADE,
  asset_type    text        NOT NULL,                                       -- sharepoint_doc, email_mailbox, employee_record, etc.
  asset_ref     text,                                                       -- external ID / reference
  path_or_url   text,                                                       -- file path, URL, or location
  title         text        NOT NULL,
  last_seen_at  timestamptz DEFAULT now(),
  size_bytes    bigint      DEFAULT 0,
  metadata_json jsonb       DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_assets_system   ON public.data_assets(system_id);
CREATE INDEX IF NOT EXISTS idx_data_assets_tenant   ON public.data_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_assets_type     ON public.data_assets(asset_type);

COMMENT ON TABLE public.data_assets IS
  'Discoverable data objects (files, records, mailboxes) within connected systems.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 3.  discovery_findings
-- ═══════════════════════════════════════════════════════════════════════════
-- PII detections linked to a specific data asset.
-- sensitivity_score: 0-30 green, 31-60 yellow, 61-100 red.

CREATE TABLE IF NOT EXISTS public.discovery_findings (
  id                   text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id            text,
  data_asset_id        text        NOT NULL REFERENCES public.data_assets(id) ON DELETE CASCADE,
  pii_category         text        NOT NULL,                                -- name, email, phone, national_id, salary, etc.
  pii_count            int         NOT NULL DEFAULT 0,
  sensitivity_score    int         NOT NULL DEFAULT 0
                                   CHECK (sensitivity_score BETWEEN 0 AND 100),
  sample_redacted_text text,
  status               text        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open', 'accepted', 'mitigated', 'false_positive')),
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disc_findings_asset   ON public.discovery_findings(data_asset_id);
CREATE INDEX IF NOT EXISTS idx_disc_findings_tenant  ON public.discovery_findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disc_findings_status  ON public.discovery_findings(status);
CREATE INDEX IF NOT EXISTS idx_disc_findings_score   ON public.discovery_findings(sensitivity_score);

COMMENT ON TABLE public.discovery_findings IS
  'PII detections within data assets. Named discovery_findings to avoid conflict with the Copilot findings table.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 4.  scan_jobs
-- ═══════════════════════════════════════════════════════════════════════════
-- Background PII-scan runs, one per system per invocation.

CREATE TABLE IF NOT EXISTS public.scan_jobs (
  id            text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     text,
  system_id     text        NOT NULL REFERENCES public."systems"(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'queued'
                            CHECK (status IN ('queued', 'running', 'done', 'failed')),
  started_at    timestamptz,
  finished_at   timestamptz,
  stats_json    jsonb       DEFAULT '{}',
  error_text    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_system ON public.scan_jobs(system_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_tenant ON public.scan_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON public.scan_jobs(status);

COMMENT ON TABLE public.scan_jobs IS
  'Background PII scan runs per system. Tracks status, timing, and stats.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 5.  dsar_case_items
-- ═══════════════════════════════════════════════════════════════════════════
-- Links DSAR cases to specific data assets with include/exclude decisions.

CREATE TABLE IF NOT EXISTS public.dsar_case_items (
  id            text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     text,
  dsar_case_id  text        NOT NULL REFERENCES public."dsar_cases"(id) ON DELETE CASCADE,
  data_asset_id text        NOT NULL REFERENCES public.data_assets(id) ON DELETE CASCADE,
  decision      text        NOT NULL DEFAULT 'include'
                            CHECK (decision IN ('include', 'exclude')),
  reason        text,
  exported_at   timestamptz,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsar_case_items_case   ON public.dsar_case_items(dsar_case_id);
CREATE INDEX IF NOT EXISTS idx_dsar_case_items_asset  ON public.dsar_case_items(data_asset_id);
CREATE INDEX IF NOT EXISTS idx_dsar_case_items_tenant ON public.dsar_case_items(tenant_id);

COMMENT ON TABLE public.dsar_case_items IS
  'Links DSAR cases to data assets with include/exclude decisions for response preparation.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 6.  HEATMAP SUMMARY VIEW
-- ═══════════════════════════════════════════════════════════════════════════
-- Aggregates findings by system and asset type for the heatmap dashboard.

DROP VIEW IF EXISTS public.v_discovery_heatmap;

CREATE VIEW public.v_discovery_heatmap AS
SELECT
  s.id                                                              AS system_id,
  s."name"                                                          AS system_name,
  s."type"                                                          AS system_type,
  s."criticality"::text                                             AS system_criticality,
  da.asset_type,
  COUNT(df.id)::int                                                 AS finding_count,
  COUNT(df.id)::int FILTER (WHERE df.sensitivity_score <= 30)       AS green_count,
  COUNT(df.id)::int FILTER (WHERE df.sensitivity_score BETWEEN 31 AND 60) AS yellow_count,
  COUNT(df.id)::int FILTER (WHERE df.sensitivity_score > 60)        AS red_count,
  COALESCE(AVG(df.sensitivity_score), 0)::int                       AS avg_sensitivity,
  COALESCE(SUM(df.pii_count), 0)::bigint                           AS total_pii_count,
  COUNT(DISTINCT da.id)::int                                        AS asset_count
FROM public."systems" s
JOIN public.data_assets da ON da.system_id = s.id
LEFT JOIN public.discovery_findings df ON df.data_asset_id = da.id
GROUP BY s.id, s."name", s."type", s."criticality", da.asset_type
ORDER BY COALESCE(AVG(df.sensitivity_score), 0) DESC;

COMMENT ON VIEW public.v_discovery_heatmap IS
  'Aggregated discovery findings by system and asset type for heatmap visualization.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 7.  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
-- MVP: single-tenant demo. Authenticated users get full CRUD access.
-- Service-role key (used by API routes) bypasses RLS entirely.
-- Anon role: implicit deny (no policy = 0 rows).
--
-- Future: replace with tenant-scoped policies using pp_tenant_id().

-- Enable RLS
ALTER TABLE public.data_assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_findings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_jobs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsar_case_items     ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DROP POLICY IF EXISTS pp_data_assets_auth_all         ON public.data_assets;
DROP POLICY IF EXISTS pp_discovery_findings_auth_all  ON public.discovery_findings;
DROP POLICY IF EXISTS pp_scan_jobs_auth_all           ON public.scan_jobs;
DROP POLICY IF EXISTS pp_dsar_case_items_auth_all     ON public.dsar_case_items;

-- MVP: authenticated users full access
CREATE POLICY pp_data_assets_auth_all ON public.data_assets
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY pp_discovery_findings_auth_all ON public.discovery_findings
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY pp_scan_jobs_auth_all ON public.scan_jobs
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY pp_dsar_case_items_auth_all ON public.dsar_case_items
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Future tenant-scoped policies (commented out) ──────────────────────
-- When ready for multi-tenant, replace the above with:
--
-- CREATE POLICY pp_data_assets_tenant_select ON public.data_assets
--   FOR SELECT TO authenticated
--   USING (tenant_id = public.pp_tenant_id());
--
-- CREATE POLICY pp_data_assets_tenant_insert ON public.data_assets
--   FOR INSERT TO authenticated
--   WITH CHECK (tenant_id = public.pp_tenant_id());
--
-- (Repeat for UPDATE, DELETE, and for each table.)


-- ═══════════════════════════════════════════════════════════════════════════
-- 8.  VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Confirm tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('data_assets', 'discovery_findings', 'scan_jobs', 'dsar_case_items')
ORDER BY table_name;

-- Confirm RLS is enabled
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('data_assets', 'discovery_findings', 'scan_jobs', 'dsar_case_items')
ORDER BY tablename;

-- List policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE policyname LIKE 'pp_%'
  AND tablename IN ('data_assets', 'discovery_findings', 'scan_jobs', 'dsar_case_items')
ORDER BY tablename, policyname;

COMMIT;
