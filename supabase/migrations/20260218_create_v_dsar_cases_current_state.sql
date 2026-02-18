-- =============================================================================
-- View: public.v_dsar_cases_current_state
--
-- Returns one row per DSAR case with the most recent state transition.
-- If a case has no transitions yet, the current state falls back to the
-- status column on dsar_cases itself.
-- =============================================================================

DROP VIEW IF EXISTS public.v_dsar_cases_current_state;

CREATE VIEW public.v_dsar_cases_current_state AS
SELECT
  c."id"                                          AS case_id,
  c."caseNumber"                                  AS case_number,
  COALESCE(t."toStatus", c."status")::text        AS current_state,
  COALESCE(t."changedAt", c."createdAt")           AS state_changed_at,
  c."tenantId"                                    AS tenant_id,
  c."dueDate"                                     AS due_at,
  c."assignedToUserId"                            AS assigned_to
FROM public."dsar_cases" c
LEFT JOIN LATERAL (
  SELECT st."toStatus", st."changedAt"
  FROM public."dsar_state_transitions" st
  WHERE st."caseId" = c."id"
  ORDER BY st."changedAt" DESC
  LIMIT 1
) t ON true
WHERE c."deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- Usage examples:
--
--   -- All cases for a tenant
--   SELECT * FROM v_dsar_cases_current_state
--   WHERE tenant_id = '<tenant-uuid>';
--
--   -- Only open (non-terminal) cases
--   SELECT * FROM v_dsar_cases_current_state
--   WHERE current_state NOT IN ('CLOSED', 'REJECTED');
--
--   -- Overdue cases
--   SELECT * FROM v_dsar_cases_current_state
--   WHERE due_at < now()
--     AND current_state NOT IN ('CLOSED', 'REJECTED');
-- ---------------------------------------------------------------------------

COMMENT ON VIEW public.v_dsar_cases_current_state IS
  'Per-case current state derived from the latest dsar_state_transitions row. '
  'Falls back to dsar_cases.status if no transition exists.';
