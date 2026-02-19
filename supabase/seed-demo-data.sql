-- ============================================================================
-- PrivacyPilot — Demo Seed Data
-- ============================================================================
--
-- Erzeugt 20 realistische DSAR-Cases mit State Transitions und Incidents.
-- Direkt im Supabase SQL Editor ausfuehrbar.
--
-- SETUP (Reihenfolge):
--   1. Supabase SQL Editor oeffnen
--   2. Zuerst die Prisma-Migration ausfuehren (Tabellen muessen existieren)
--   3. Dann die View-Migration (20260218_create_v_dsar_cases_current_state.sql)
--   4. Dann dieses Script ausfuehren
--
-- LOGIN nach Seed:
--   Email:    daniel.schormann@gmail.com
--   Passwort: admin123
--
-- NICHT-DESTRUKTIV: Kein DROP, kein TRUNCATE, kein DELETE.
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 0.  FESTE IDs (deterministisch, idempotent-faehig)
-- ═══════════════════════════════════════════════════════════════════════════

-- Tenant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "tenants" WHERE "id" = 'tenant_demo_1') THEN
    INSERT INTO "tenants" ("id", "name", "slaDefaultDays", "dueSoonDays", "retentionDays", "createdAt", "updatedAt")
    VALUES ('tenant_demo_1', 'Demo GmbH', 30, 7, 365, NOW(), NOW());
  END IF;
END $$;

-- Users
-- Passwort-Hashes (bcrypt, 12 rounds):
--   admin123    → $2a$12$k2Et5qGFcr6S/6cFKmqcauOzQtBnQ7yTdwbrRyacedlgXvQI.66RO
--   admin123456 → $2a$12$6TV745e6vDa5Ig1kjBBQGevyKglqCrB6t3xXjk5xsOYF2UZNP.2xu
INSERT INTO "users" ("id", "tenantId", "email", "name", "passwordHash", "role", "createdAt", "updatedAt")
VALUES
  ('usr_demo_daniel_s', 'tenant_demo_1', 'daniel.schormann@gmail.com', 'Daniel Schormann', '$2a$12$k2Et5qGFcr6S/6cFKmqcauOzQtBnQ7yTdwbrRyacedlgXvQI.66RO', 'TENANT_ADMIN', NOW(), NOW()),
  ('usr_demo_daniel',   'tenant_demo_1', 'daniel@demo.de',             'Daniel Hartmann',  '$2a$12$k2Et5qGFcr6S/6cFKmqcauOzQtBnQ7yTdwbrRyacedlgXvQI.66RO', 'DPO',          NOW(), NOW()),
  ('usr_demo_sabine',   'tenant_demo_1', 'sabine@demo.de',             'Sabine Richter',   '$2a$12$k2Et5qGFcr6S/6cFKmqcauOzQtBnQ7yTdwbrRyacedlgXvQI.66RO', 'CASE_MANAGER',  NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Data Subjects (20 Personen)
INSERT INTO "data_subjects" ("id", "tenantId", "fullName", "email", "createdAt", "updatedAt")
VALUES
  ('ds_01', 'tenant_demo_1', 'Hans Mueller',       'hans.mueller@example.de',       NOW(), NOW()),
  ('ds_02', 'tenant_demo_1', 'Sabine Weber',       'sabine.weber@example.de',       NOW(), NOW()),
  ('ds_03', 'tenant_demo_1', 'Matthias Koch',      'matthias.koch@example.de',      NOW(), NOW()),
  ('ds_04', 'tenant_demo_1', 'Claudia Becker',     'claudia.becker@example.de',     NOW(), NOW()),
  ('ds_05', 'tenant_demo_1', 'Thomas Schaefer',    'thomas.schaefer@example.de',    NOW(), NOW()),
  ('ds_06', 'tenant_demo_1', 'Petra Hoffmann',     'petra.hoffmann@example.de',     NOW(), NOW()),
  ('ds_07', 'tenant_demo_1', 'Stefan Zimmermann',  'stefan.zimmermann@example.de',  NOW(), NOW()),
  ('ds_08', 'tenant_demo_1', 'Monika Wagner',      'monika.wagner@example.de',      NOW(), NOW()),
  ('ds_09', 'tenant_demo_1', 'Juergen Schulz',     'juergen.schulz@example.de',     NOW(), NOW()),
  ('ds_10', 'tenant_demo_1', 'Karin Fischer',      'karin.fischer@example.de',      NOW(), NOW()),
  ('ds_11', 'tenant_demo_1', 'Andreas Braun',      'andreas.braun@example.de',      NOW(), NOW()),
  ('ds_12', 'tenant_demo_1', 'Ursula Lange',       'ursula.lange@example.de',       NOW(), NOW()),
  ('ds_13', 'tenant_demo_1', 'Frank Krause',       'frank.krause@example.de',       NOW(), NOW()),
  ('ds_14', 'tenant_demo_1', 'Birgit Schmitt',     'birgit.schmitt@example.de',     NOW(), NOW()),
  ('ds_15', 'tenant_demo_1', 'Rainer Schwarz',     'rainer.schwarz@example.de',     NOW(), NOW()),
  ('ds_16', 'tenant_demo_1', 'Heike Mayer',        'heike.mayer@example.de',        NOW(), NOW()),
  ('ds_17', 'tenant_demo_1', 'Dirk Neumann',       'dirk.neumann@example.de',       NOW(), NOW()),
  ('ds_18', 'tenant_demo_1', 'Gabriele Wolf',      'gabriele.wolf@example.de',      NOW(), NOW()),
  ('ds_19', 'tenant_demo_1', 'Holger Peters',      'holger.peters@example.de',      NOW(), NOW()),
  ('ds_20', 'tenant_demo_1', 'Ingrid Berger',      'ingrid.berger@example.de',      NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Incidents (5 Stueck, fuer Incident-Linking)
INSERT INTO "incidents" ("id", "tenantId", "title", "description", "severity", "status", "createdByUserId", "createdAt", "updatedAt")
VALUES
  ('inc_01', 'tenant_demo_1', 'Unauthorized data access via admin panel',     'Employee accessed customer records without authorization.',  'HIGH',     'OPEN',       'usr_demo_daniel', NOW() - INTERVAL '10 days', NOW()),
  ('inc_02', 'tenant_demo_1', 'Email misconfiguration leaked PII',           'Automated report sent to wrong distribution list.',          'CRITICAL', 'CONTAINED',  'usr_demo_daniel', NOW() - INTERVAL '15 days', NOW()),
  ('inc_03', 'tenant_demo_1', 'Third-party processor data breach',           'Vendor reported potential breach affecting shared data.',     'HIGH',     'OPEN',       'usr_demo_sabine', NOW() - INTERVAL '8 days',  NOW()),
  ('inc_04', 'tenant_demo_1', 'Lost laptop with unencrypted customer data',  'Device lost during business travel.',                        'MEDIUM',   'RESOLVED',   'usr_demo_sabine', NOW() - INTERVAL '25 days', NOW()),
  ('inc_05', 'tenant_demo_1', 'API endpoint exposed personal data',          'Public endpoint returned PII without authentication.',       'CRITICAL', 'CONTAINED',  'usr_demo_daniel', NOW() - INTERVAL '5 days',  NOW())
ON CONFLICT ("id") DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1.  DSAR CASES (20 Stueck)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Status-Verteilung:
--   8x open    (DATA_COLLECTION)
--   5x review  (REVIEW_LEGAL)
--   5x closed  (CLOSED)
--   2x reject  (REJECTED)
--
-- Due-Date-Verteilung:
--   Cases 01-05: overdue   (NOW - 5 Tage)
--   Cases 06-10: due soon  (NOW + 3 Tage)
--   Cases 11-20: normal    (NOW + 20 Tage)

INSERT INTO "dsar_cases" (
  "id", "tenantId", "caseNumber", "type", "status", "priority",
  "description", "dueDate", "receivedAt", "createdAt", "updatedAt",
  "dataSubjectId", "createdByUserId", "assignedToUserId"
)
VALUES
  -- ── OVERDUE (5) ──────────────────────────────────────────────────────
  ('case_01', 'tenant_demo_1', 'DSAR-2026-001', 'ACCESS',        'DATA_COLLECTION', 'HIGH',
   'Auskunftsersuchen Hans Mueller',       NOW() - INTERVAL '5 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days', NOW(),
   'ds_01', 'usr_demo_daniel', 'usr_demo_daniel'),

  ('case_02', 'tenant_demo_1', 'DSAR-2026-002', 'ERASURE',       'DATA_COLLECTION', 'CRITICAL',
   'Loeschantrag Sabine Weber',            NOW() - INTERVAL '5 days', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days', NOW(),
   'ds_02', 'usr_demo_daniel', 'usr_demo_sabine'),

  ('case_03', 'tenant_demo_1', 'DSAR-2026-003', 'ACCESS',        'REVIEW_LEGAL',    'HIGH',
   'Datenauskunft Matthias Koch',          NOW() - INTERVAL '5 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days', NOW(),
   'ds_03', 'usr_demo_sabine', 'usr_demo_daniel'),

  ('case_04', 'tenant_demo_1', 'DSAR-2026-004', 'PORTABILITY',   'REVIEW_LEGAL',    'MEDIUM',
   'Datenportabilitaet Claudia Becker',    NOW() - INTERVAL '5 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', NOW(),
   'ds_04', 'usr_demo_sabine', 'usr_demo_sabine'),

  ('case_05', 'tenant_demo_1', 'DSAR-2026-005', 'RECTIFICATION', 'DATA_COLLECTION', 'HIGH',
   'Berichtigungsantrag Thomas Schaefer',  NOW() - INTERVAL '5 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', NOW(),
   'ds_05', 'usr_demo_daniel', 'usr_demo_daniel'),

  -- ── DUE SOON (5) ────────────────────────────────────────────────────
  ('case_06', 'tenant_demo_1', 'DSAR-2026-006', 'ACCESS',        'DATA_COLLECTION', 'MEDIUM',
   'Auskunftsersuchen Petra Hoffmann',     NOW() + INTERVAL '3 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', NOW(),
   'ds_06', 'usr_demo_daniel', 'usr_demo_sabine'),

  ('case_07', 'tenant_demo_1', 'DSAR-2026-007', 'ERASURE',       'DATA_COLLECTION', 'HIGH',
   'Loeschantrag Stefan Zimmermann',       NOW() + INTERVAL '3 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NOW(),
   'ds_07', 'usr_demo_sabine', 'usr_demo_daniel'),

  ('case_08', 'tenant_demo_1', 'DSAR-2026-008', 'ACCESS',        'REVIEW_LEGAL',    'MEDIUM',
   'Datenauskunft Monika Wagner',          NOW() + INTERVAL '3 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', NOW(),
   'ds_08', 'usr_demo_daniel', 'usr_demo_sabine'),

  ('case_09', 'tenant_demo_1', 'DSAR-2026-009', 'OBJECTION',     'DATA_COLLECTION', 'LOW',
   'Widerspruch Juergen Schulz',           NOW() + INTERVAL '3 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW(),
   'ds_09', 'usr_demo_sabine', 'usr_demo_daniel'),

  ('case_10', 'tenant_demo_1', 'DSAR-2026-010', 'ACCESS',        'DATA_COLLECTION', 'MEDIUM',
   'Auskunftsersuchen Karin Fischer',      NOW() + INTERVAL '3 days', NOW() - INTERVAL '8 days',  NOW() - INTERVAL '8 days',  NOW(),
   'ds_10', 'usr_demo_daniel', 'usr_demo_sabine'),

  -- ── NORMAL DUE (10) ─────────────────────────────────────────────────
  ('case_11', 'tenant_demo_1', 'DSAR-2026-011', 'ACCESS',        'DATA_COLLECTION', 'LOW',
   'Auskunftsersuchen Andreas Braun',      NOW() + INTERVAL '20 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', NOW(),
   'ds_11', 'usr_demo_daniel', 'usr_demo_daniel'),

  ('case_12', 'tenant_demo_1', 'DSAR-2026-012', 'ERASURE',       'REVIEW_LEGAL',    'MEDIUM',
   'Loeschantrag Ursula Lange',            NOW() + INTERVAL '20 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days', NOW(),
   'ds_12', 'usr_demo_sabine', 'usr_demo_sabine'),

  ('case_13', 'tenant_demo_1', 'DSAR-2026-013', 'RESTRICTION',   'REVIEW_LEGAL',    'LOW',
   'Einschraenkung Frank Krause',          NOW() + INTERVAL '20 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW(),
   'ds_13', 'usr_demo_daniel', 'usr_demo_daniel'),

  ('case_14', 'tenant_demo_1', 'DSAR-2026-014', 'ACCESS',        'DATA_COLLECTION', 'MEDIUM',
   'Auskunftsersuchen Birgit Schmitt',     NOW() + INTERVAL '20 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NOW(),
   'ds_14', 'usr_demo_sabine', 'usr_demo_sabine'),

  ('case_15', 'tenant_demo_1', 'DSAR-2026-015', 'PORTABILITY',   'DATA_COLLECTION', 'LOW',
   'Datenportabilitaet Rainer Schwarz',    NOW() + INTERVAL '20 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW(),
   'ds_15', 'usr_demo_daniel', 'usr_demo_daniel'),

  ('case_16', 'tenant_demo_1', 'DSAR-2026-016', 'ACCESS',        'CLOSED',          'MEDIUM',
   'Auskunft abgeschlossen Heike Mayer',   NOW() + INTERVAL '20 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days', NOW(),
   'ds_16', 'usr_demo_sabine', 'usr_demo_sabine'),

  ('case_17', 'tenant_demo_1', 'DSAR-2026-017', 'ERASURE',       'CLOSED',          'HIGH',
   'Loeschung abgeschlossen Dirk Neumann', NOW() + INTERVAL '20 days', NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days', NOW(),
   'ds_17', 'usr_demo_daniel', 'usr_demo_daniel'),

  ('case_18', 'tenant_demo_1', 'DSAR-2026-018', 'ACCESS',        'CLOSED',          'LOW',
   'Auskunft erteilt Gabriele Wolf',       NOW() + INTERVAL '20 days', NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days', NOW(),
   'ds_18', 'usr_demo_sabine', 'usr_demo_sabine'),

  ('case_19', 'tenant_demo_1', 'DSAR-2026-019', 'OBJECTION',     'REJECTED',        'LOW',
   'Widerspruch abgelehnt Holger Peters',  NOW() + INTERVAL '20 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', NOW(),
   'ds_19', 'usr_demo_daniel', 'usr_demo_daniel'),

  ('case_20', 'tenant_demo_1', 'DSAR-2026-020', 'ERASURE',       'REJECTED',        'MEDIUM',
   'Loeschantrag abgelehnt Ingrid Berger', NOW() + INTERVAL '20 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', NOW(),
   'ds_20', 'usr_demo_sabine', 'usr_demo_sabine')

ON CONFLICT ("id") DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2.  STATE TRANSITIONS
-- ═══════════════════════════════════════════════════════════════════════════
-- Jeder Case bekommt eine realistische Transition-Kette.

INSERT INTO "dsar_state_transitions" (
  "id", "tenantId", "caseId", "fromStatus", "toStatus",
  "changedByUserId", "changedAt", "reason"
)
VALUES
  -- ── Cases 01-08: open (DATA_COLLECTION) ─────────────────────────────
  -- Transition: NEW → INTAKE_TRIAGE → DATA_COLLECTION
  ('tr_01a', 'tenant_demo_1', 'case_01', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_daniel', NOW() - INTERVAL '27 days', 'Identity confirmed, triaging'),
  ('tr_01b', 'tenant_demo_1', 'case_01', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_daniel', NOW() - INTERVAL '25 days', 'Triage complete, collecting data'),

  ('tr_02a', 'tenant_demo_1', 'case_02', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_daniel', NOW() - INTERVAL '24 days', 'Erasure request validated'),
  ('tr_02b', 'tenant_demo_1', 'case_02', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_sabine', NOW() - INTERVAL '22 days', 'Mapping affected systems'),

  ('tr_05a', 'tenant_demo_1', 'case_05', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_daniel', NOW() - INTERVAL '17 days', 'Rectification scope defined'),
  ('tr_05b', 'tenant_demo_1', 'case_05', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_daniel', NOW() - INTERVAL '15 days', 'Collecting current records'),

  ('tr_06a', 'tenant_demo_1', 'case_06', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_sabine', NOW() - INTERVAL '14 days', 'Access request accepted'),
  ('tr_06b', 'tenant_demo_1', 'case_06', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_sabine', NOW() - INTERVAL '12 days', 'Querying all systems'),

  ('tr_07a', 'tenant_demo_1', 'case_07', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_sabine', NOW() - INTERVAL '13 days', 'Erasure request triaged'),
  ('tr_07b', 'tenant_demo_1', 'case_07', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_daniel', NOW() - INTERVAL '11 days', 'Identifying data stores'),

  ('tr_09a', 'tenant_demo_1', 'case_09', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_sabine', NOW() - INTERVAL '9 days',  'Objection received, reviewing'),
  ('tr_09b', 'tenant_demo_1', 'case_09', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_daniel', NOW() - INTERVAL '7 days',  'Collecting processing records'),

  ('tr_10a', 'tenant_demo_1', 'case_10', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_daniel', NOW() - INTERVAL '7 days',  'Standard access request'),
  ('tr_10b', 'tenant_demo_1', 'case_10', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_sabine', NOW() - INTERVAL '5 days',  'Data collection started'),

  ('tr_11a', 'tenant_demo_1', 'case_11', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_daniel', NOW() - INTERVAL '6 days',  'Triage initiated'),
  ('tr_11b', 'tenant_demo_1', 'case_11', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_daniel', NOW() - INTERVAL '4 days',  'Awaiting system responses'),

  ('tr_14a', 'tenant_demo_1', 'case_14', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_sabine', NOW() - INTERVAL '3 days',  'Access request validated'),
  ('tr_14b', 'tenant_demo_1', 'case_14', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_sabine', NOW() - INTERVAL '2 days',  'Collecting from CRM and ERP'),

  ('tr_15a', 'tenant_demo_1', 'case_15', 'NEW',           'INTAKE_TRIAGE',    'usr_demo_daniel', NOW() - INTERVAL '2 days',  'Portability request, checking format'),
  ('tr_15b', 'tenant_demo_1', 'case_15', 'INTAKE_TRIAGE', 'DATA_COLLECTION',  'usr_demo_daniel', NOW() - INTERVAL '1 day',   'Preparing machine-readable export'),

  -- ── Cases 03,04,08,12,13: review (REVIEW_LEGAL) ────────────────────
  -- Transition: NEW → INTAKE_TRIAGE → DATA_COLLECTION → REVIEW_LEGAL
  ('tr_03a', 'tenant_demo_1', 'case_03', 'NEW',              'INTAKE_TRIAGE',    'usr_demo_sabine', NOW() - INTERVAL '21 days', 'Access request triaged'),
  ('tr_03b', 'tenant_demo_1', 'case_03', 'INTAKE_TRIAGE',    'DATA_COLLECTION',  'usr_demo_daniel', NOW() - INTERVAL '18 days', 'Data collection complete'),
  ('tr_03c', 'tenant_demo_1', 'case_03', 'DATA_COLLECTION',  'REVIEW_LEGAL',     'usr_demo_daniel', NOW() - INTERVAL '10 days', 'Legal team reviewing exemptions'),

  ('tr_04a', 'tenant_demo_1', 'case_04', 'NEW',              'INTAKE_TRIAGE',    'usr_demo_sabine', NOW() - INTERVAL '19 days', 'Portability format determined'),
  ('tr_04b', 'tenant_demo_1', 'case_04', 'INTAKE_TRIAGE',    'DATA_COLLECTION',  'usr_demo_sabine', NOW() - INTERVAL '16 days', 'All data collected'),
  ('tr_04c', 'tenant_demo_1', 'case_04', 'DATA_COLLECTION',  'REVIEW_LEGAL',     'usr_demo_sabine', NOW() - INTERVAL '8 days',  'Checking third-party obligations'),

  ('tr_08a', 'tenant_demo_1', 'case_08', 'NEW',              'INTAKE_TRIAGE',    'usr_demo_daniel', NOW() - INTERVAL '11 days', 'Access request scope defined'),
  ('tr_08b', 'tenant_demo_1', 'case_08', 'INTAKE_TRIAGE',    'DATA_COLLECTION',  'usr_demo_sabine', NOW() - INTERVAL '8 days',  'Data gathered from 3 systems'),
  ('tr_08c', 'tenant_demo_1', 'case_08', 'DATA_COLLECTION',  'REVIEW_LEGAL',     'usr_demo_sabine', NOW() - INTERVAL '4 days',  'Reviewing potential redactions'),

  ('tr_12a', 'tenant_demo_1', 'case_12', 'NEW',              'INTAKE_TRIAGE',    'usr_demo_sabine', NOW() - INTERVAL '5 days',  'Erasure scope confirmed'),
  ('tr_12b', 'tenant_demo_1', 'case_12', 'INTAKE_TRIAGE',    'DATA_COLLECTION',  'usr_demo_sabine', NOW() - INTERVAL '3 days',  'Identified all storage locations'),
  ('tr_12c', 'tenant_demo_1', 'case_12', 'DATA_COLLECTION',  'REVIEW_LEGAL',     'usr_demo_sabine', NOW() - INTERVAL '1 day',   'Checking retention obligations'),

  ('tr_13a', 'tenant_demo_1', 'case_13', 'NEW',              'INTAKE_TRIAGE',    'usr_demo_daniel', NOW() - INTERVAL '4 days',  'Restriction request evaluated'),
  ('tr_13b', 'tenant_demo_1', 'case_13', 'INTAKE_TRIAGE',    'DATA_COLLECTION',  'usr_demo_daniel', NOW() - INTERVAL '2 days',  'Processing records assembled'),
  ('tr_13c', 'tenant_demo_1', 'case_13', 'DATA_COLLECTION',  'REVIEW_LEGAL',     'usr_demo_daniel', NOW() - INTERVAL '6 hours', 'Legal assessment pending'),

  -- ── Cases 16,17,18: closed (CLOSED) ────────────────────────────────
  -- Full chain: NEW → INTAKE_TRIAGE → DATA_COLLECTION → REVIEW_LEGAL → RESPONSE_PREPARATION → RESPONSE_SENT → CLOSED
  ('tr_16a', 'tenant_demo_1', 'case_16', 'NEW',                  'INTAKE_TRIAGE',        'usr_demo_sabine', NOW() - INTERVAL '27 days', 'Request validated'),
  ('tr_16b', 'tenant_demo_1', 'case_16', 'INTAKE_TRIAGE',        'DATA_COLLECTION',      'usr_demo_sabine', NOW() - INTERVAL '24 days', 'Data collected'),
  ('tr_16c', 'tenant_demo_1', 'case_16', 'DATA_COLLECTION',      'REVIEW_LEGAL',         'usr_demo_sabine', NOW() - INTERVAL '20 days', 'Legal review passed'),
  ('tr_16d', 'tenant_demo_1', 'case_16', 'REVIEW_LEGAL',         'RESPONSE_PREPARATION', 'usr_demo_sabine', NOW() - INTERVAL '15 days', 'Drafting response'),
  ('tr_16e', 'tenant_demo_1', 'case_16', 'RESPONSE_PREPARATION', 'RESPONSE_SENT',        'usr_demo_sabine', NOW() - INTERVAL '10 days', 'Response sent to subject'),
  ('tr_16f', 'tenant_demo_1', 'case_16', 'RESPONSE_SENT',        'CLOSED',               'usr_demo_sabine', NOW() - INTERVAL '5 days',  'Case completed successfully'),

  ('tr_17a', 'tenant_demo_1', 'case_17', 'NEW',                  'INTAKE_TRIAGE',        'usr_demo_daniel', NOW() - INTERVAL '25 days', 'Erasure request triaged'),
  ('tr_17b', 'tenant_demo_1', 'case_17', 'INTAKE_TRIAGE',        'DATA_COLLECTION',      'usr_demo_daniel', NOW() - INTERVAL '22 days', 'Mapping data for deletion'),
  ('tr_17c', 'tenant_demo_1', 'case_17', 'DATA_COLLECTION',      'REVIEW_LEGAL',         'usr_demo_daniel', NOW() - INTERVAL '18 days', 'Checked retention periods'),
  ('tr_17d', 'tenant_demo_1', 'case_17', 'REVIEW_LEGAL',         'RESPONSE_PREPARATION', 'usr_demo_daniel', NOW() - INTERVAL '14 days', 'Preparing deletion confirmation'),
  ('tr_17e', 'tenant_demo_1', 'case_17', 'RESPONSE_PREPARATION', 'RESPONSE_SENT',        'usr_demo_daniel', NOW() - INTERVAL '8 days',  'Confirmation sent'),
  ('tr_17f', 'tenant_demo_1', 'case_17', 'RESPONSE_SENT',        'CLOSED',               'usr_demo_daniel', NOW() - INTERVAL '3 days',  'All data deleted, case closed'),

  ('tr_18a', 'tenant_demo_1', 'case_18', 'NEW',                  'INTAKE_TRIAGE',        'usr_demo_sabine', NOW() - INTERVAL '23 days', 'Simple access request'),
  ('tr_18b', 'tenant_demo_1', 'case_18', 'INTAKE_TRIAGE',        'DATA_COLLECTION',      'usr_demo_sabine', NOW() - INTERVAL '20 days', 'Data exported'),
  ('tr_18c', 'tenant_demo_1', 'case_18', 'DATA_COLLECTION',      'REVIEW_LEGAL',         'usr_demo_sabine', NOW() - INTERVAL '16 days', 'No exemptions needed'),
  ('tr_18d', 'tenant_demo_1', 'case_18', 'REVIEW_LEGAL',         'RESPONSE_PREPARATION', 'usr_demo_sabine', NOW() - INTERVAL '12 days', 'Preparing data package'),
  ('tr_18e', 'tenant_demo_1', 'case_18', 'RESPONSE_PREPARATION', 'RESPONSE_SENT',        'usr_demo_sabine', NOW() - INTERVAL '7 days',  'Sent via secure portal'),
  ('tr_18f', 'tenant_demo_1', 'case_18', 'RESPONSE_SENT',        'CLOSED',               'usr_demo_sabine', NOW() - INTERVAL '2 days',  'Subject confirmed receipt'),

  -- ── Cases 19,20: rejected (REJECTED) ───────────────────────────────
  -- Transition: NEW → INTAKE_TRIAGE → REJECTED
  ('tr_19a', 'tenant_demo_1', 'case_19', 'NEW',           'INTAKE_TRIAGE', 'usr_demo_daniel', NOW() - INTERVAL '19 days', 'Reviewing objection basis'),
  ('tr_19b', 'tenant_demo_1', 'case_19', 'INTAKE_TRIAGE', 'REJECTED',      'usr_demo_daniel', NOW() - INTERVAL '16 days', 'No valid legal basis for objection. Processing is based on legitimate interest with safeguards.'),

  ('tr_20a', 'tenant_demo_1', 'case_20', 'NEW',           'INTAKE_TRIAGE', 'usr_demo_sabine', NOW() - INTERVAL '17 days', 'Evaluating erasure request'),
  ('tr_20b', 'tenant_demo_1', 'case_20', 'INTAKE_TRIAGE', 'REJECTED',      'usr_demo_sabine', NOW() - INTERVAL '14 days', 'Legal retention obligation (6 years tax law). Erasure not possible until 2029.')

ON CONFLICT ("id") DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3.  INCIDENT LINKS (5 Cases verknuepft)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO "dsar_incidents" (
  "id", "tenantId", "caseId", "incidentId", "linkReason",
  "subjectInScope", "linkedByUserId", "createdAt"
)
VALUES
  ('di_01', 'tenant_demo_1', 'case_01', 'inc_01', 'Subject data was part of unauthorized access scope',     'YES',     'usr_demo_daniel', NOW() - INTERVAL '20 days'),
  ('di_02', 'tenant_demo_1', 'case_02', 'inc_02', 'PII leaked via misconfigured email distribution',        'YES',     'usr_demo_daniel', NOW() - INTERVAL '18 days'),
  ('di_03', 'tenant_demo_1', 'case_05', 'inc_03', 'Subject data held by breached processor',                'UNKNOWN', 'usr_demo_sabine', NOW() - INTERVAL '12 days'),
  ('di_04', 'tenant_demo_1', 'case_07', 'inc_04', 'Subject records were on lost device',                    'YES',     'usr_demo_sabine', NOW() - INTERVAL '10 days'),
  ('di_05', 'tenant_demo_1', 'case_10', 'inc_05', 'Subject data exposed via unauthenticated API endpoint',  'YES',     'usr_demo_daniel', NOW() - INTERVAL '5 days')
ON CONFLICT ("id") DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4.  VERIFIKATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Zaehlung pro Status
SELECT "status", COUNT(*)::int AS cnt
FROM "dsar_cases"
WHERE "tenantId" = 'tenant_demo_1'
GROUP BY "status"
ORDER BY cnt DESC;

-- Due-Verteilung
SELECT
  CASE
    WHEN "dueDate" < NOW() THEN 'overdue'
    WHEN "dueDate" <= NOW() + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'normal'
  END AS due_bucket,
  COUNT(*)::int AS cnt
FROM "dsar_cases"
WHERE "tenantId" = 'tenant_demo_1'
  AND "status" NOT IN ('CLOSED', 'REJECTED')
GROUP BY due_bucket;

-- Incident-Links
SELECT COUNT(DISTINCT "caseId")::int AS incident_linked_cases
FROM "dsar_incidents"
WHERE "tenantId" = 'tenant_demo_1';

COMMIT;
