-- Sprint 9.3: Performance Indices Migration
-- Adds composite indices for frequently filtered/sorted columns across key tables.

-- ═══════════════════════════════════════════════════════════════════════════════
-- DSARCase: dashboard filters, SLA views, search
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "dsar_cases_tenant_received_at" ON "dsar_cases" ("tenantId", "receivedAt" DESC);
CREATE INDEX IF NOT EXISTS "dsar_cases_tenant_due_date" ON "dsar_cases" ("tenantId", "dueDate");
CREATE INDEX IF NOT EXISTS "dsar_cases_tenant_priority" ON "dsar_cases" ("tenantId", "priority");
CREATE INDEX IF NOT EXISTS "dsar_cases_tenant_type" ON "dsar_cases" ("tenantId", "type");
CREATE INDEX IF NOT EXISTS "dsar_cases_tenant_updated_at" ON "dsar_cases" ("tenantId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "dsar_cases_tenant_status_due" ON "dsar_cases" ("tenantId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "dsar_cases_tenant_deleted_at" ON "dsar_cases" ("tenantId", "deletedAt");

-- ═══════════════════════════════════════════════════════════════════════════════
-- Task: cross-case task list, assignee views, status filters
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "tasks_tenant_status" ON "tasks" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "tasks_tenant_due_date" ON "tasks" ("tenantId", "dueDate");
CREATE INDEX IF NOT EXISTS "tasks_tenant_status_assignee" ON "tasks" ("tenantId", "status", "assigneeUserId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- Document: case documents, soft-delete, upload date filtering
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "documents_tenant_case_deleted" ON "documents" ("tenantId", "caseId", "deletedAt");
CREATE INDEX IF NOT EXISTS "documents_tenant_uploaded_at" ON "documents" ("tenantId", "uploadedAt" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- AuditLog: timeline queries, entity lookups
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_created_at" ON "audit_logs" ("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_action" ON "audit_logs" ("tenantId", "action");

-- ═══════════════════════════════════════════════════════════════════════════════
-- SearchIndexEntry: full-text search GIN index on tsvector (if column exists)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Add tsvector column if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_index_entries' AND column_name = 'fts_vector'
  ) THEN
    ALTER TABLE "search_index_entries" ADD COLUMN "fts_vector" tsvector;
  END IF;
END $$;

-- Populate fts_vector from title + bodyText
UPDATE "search_index_entries"
SET "fts_vector" = to_tsvector('english', coalesce("title", '') || ' ' || coalesce("bodyText", ''))
WHERE "fts_vector" IS NULL;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS "search_index_entries_fts_gin" ON "search_index_entries" USING GIN ("fts_vector");

-- Trigger to auto-update fts_vector on insert/update
CREATE OR REPLACE FUNCTION search_index_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW."fts_vector" := to_tsvector('english', coalesce(NEW."title", '') || ' ' || coalesce(NEW."bodyText", ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS search_index_fts_update ON "search_index_entries";
CREATE TRIGGER search_index_fts_update
  BEFORE INSERT OR UPDATE OF "title", "bodyText"
  ON "search_index_entries"
  FOR EACH ROW
  EXECUTE FUNCTION search_index_fts_trigger();

-- Composite index for entity-type + tenant scoped queries
CREATE INDEX IF NOT EXISTS "search_index_entries_tenant_entity_updated"
  ON "search_index_entries" ("tenantId", "entityType", "updatedAt" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CaseDeadline: risk dashboard, overdue detection
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "case_deadlines_tenant_risk_due" ON "case_deadlines" ("tenantId", "currentRisk", "effectiveDueAt");
CREATE INDEX IF NOT EXISTS "case_deadlines_tenant_days_remaining" ON "case_deadlines" ("tenantId", "daysRemaining");

-- ═══════════════════════════════════════════════════════════════════════════════
-- Incident: status/severity dashboard
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "incidents_tenant_updated_at" ON "incidents" ("tenantId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "incidents_tenant_created_at" ON "incidents" ("tenantId", "createdAt" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VendorRequest: status tracking, SLA, due dates
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "vendor_requests_tenant_due_at" ON "vendor_requests" ("tenantId", "dueAt");
CREATE INDEX IF NOT EXISTS "vendor_requests_tenant_updated_at" ON "vendor_requests" ("tenantId", "updatedAt" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DataCollectionItem: status progress views
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "data_collection_items_tenant_status" ON "data_collection_items" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "data_collection_items_tenant_case_status" ON "data_collection_items" ("tenantId", "caseId", "status");

-- ═══════════════════════════════════════════════════════════════════════════════
-- DeliveryEvent: timeline, case-scoped queries
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "delivery_events_tenant_timestamp" ON "delivery_events" ("tenantId", "timestamp" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- WebhookDelivery: pending delivery processing
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "webhook_deliveries_tenant_pending" ON "webhook_deliveries" ("tenantId", "status", "nextRetryAt");

-- ═══════════════════════════════════════════════════════════════════════════════
-- ConnectorRun: status tracking per tenant
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "connector_runs_tenant_created_at" ON "connector_runs" ("tenantId", "createdAt" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- JobRun: observability
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "job_runs_tenant_started_at" ON "job_runs" ("tenantId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "job_runs_tenant_job_status" ON "job_runs" ("tenantId", "jobName", "status");

-- ═══════════════════════════════════════════════════════════════════════════════
-- Comment: case-scoped, chronological
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "comments_tenant_case" ON "comments" ("tenantId", "caseId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- CommunicationLog: case-scoped, date ordered
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "communication_logs_tenant_case" ON "communication_logs" ("tenantId", "caseId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- DsarIncident: cross-reference, KPI join
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "dsar_incidents_tenant_case" ON "dsar_incidents" ("tenantId", "caseId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- DeadlineEvent: extension tracking
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS "deadline_events_tenant_type" ON "deadline_events" ("tenantId", "eventType");
CREATE INDEX IF NOT EXISTS "deadline_events_tenant_created_at" ON "deadline_events" ("tenantId", "createdAt" DESC);
