-- =============================================================================
-- View:  public.v_dsar_cases_current_state
-- Zweck: Pro DSAR-Case den aktuellen State aus der letzten Transition ermitteln.
--        Fälle ohne Transition fallen auf dsar_cases."status" zurück.
--
-- Strategie:
--   DISTINCT ON ("caseId") + ORDER BY "changedAt" DESC  liefert die
--   jüngste Transition pro Case in einem einzigen Index-Scan.
--
-- Prisma-Spaltennamen (camelCase, kein @map) → Anführungszeichen nötig.
-- =============================================================================

-- ── 0. Empfohlener Index (idempotent) ──────────────────────────────────────
-- Deckt den DISTINCT ON … ORDER BY perfekt ab.
CREATE INDEX IF NOT EXISTS idx_dsar_state_transitions_case_changed
  ON public."dsar_state_transitions" ("caseId", "changedAt" DESC);

-- ── 1. View (re-)erstellen ─────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_dsar_cases_current_state;

CREATE VIEW public.v_dsar_cases_current_state AS
SELECT
  c."id"                                           AS case_id,
  c."caseNumber"                                   AS case_number,
  COALESCE(latest."toStatus", c."status")::text    AS current_state,
  COALESCE(latest."changedAt", c."createdAt")      AS state_changed_at,
  c."tenantId"                                     AS tenant_id,
  c."dueDate"                                      AS due_at,
  c."assignedToUserId"                             AS assigned_to
FROM public."dsar_cases" c
LEFT JOIN (
  -- ── letzte Transition pro Case via DISTINCT ON ───────────────────────
  SELECT DISTINCT ON ("caseId")
    "caseId",
    "toStatus",
    "changedAt"
  FROM public."dsar_state_transitions"
  ORDER BY "caseId", "changedAt" DESC
) latest ON latest."caseId" = c."id"
WHERE c."deletedAt" IS NULL;

-- ── 2. Kommentar ───────────────────────────────────────────────────────────
COMMENT ON VIEW public.v_dsar_cases_current_state IS
  'Pro Case der aktuelle State (letzte dsar_state_transitions-Zeile). '
  'Fallback auf dsar_cases."status" wenn noch keine Transition existiert. '
  'Soft-deleted Cases (deletedAt IS NOT NULL) sind ausgeschlossen.';

-- ── 3. Usage ───────────────────────────────────────────────────────────────
--
--   -- Alle Cases eines Tenants
--   SELECT * FROM v_dsar_cases_current_state
--   WHERE tenant_id = '<uuid>';
--
--   -- Offene Cases
--   SELECT * FROM v_dsar_cases_current_state
--   WHERE current_state NOT IN ('CLOSED', 'REJECTED');
--
--   -- Überfällige Cases
--   SELECT * FROM v_dsar_cases_current_state
--   WHERE due_at < now()
--     AND current_state NOT IN ('CLOSED', 'REJECTED');
--
--   -- Mir zugewiesene offene Cases
--   SELECT * FROM v_dsar_cases_current_state
--   WHERE assigned_to = '<user-uuid>'
--     AND current_state NOT IN ('CLOSED', 'REJECTED');
