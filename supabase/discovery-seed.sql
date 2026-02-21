-- ============================================================================
-- PrivacyPilot — Discovery & Heatmap Seed Data
-- ============================================================================
--
-- Inserts realistic demo data for the discovery/heatmap feature:
--   - 4 systems: M365, Fileserver, HR-CRM, Exchange
--   - 50 data_assets across systems
--   - 200 discovery_findings (70% green, 20% yellow, 10% red)
--   - 8 scan_jobs (2 per system, various states)
--   - ~40 dsar_case_items linking existing cases to assets
--
-- PREREQUISITES:
--   1. Run the base migration (Prisma schema must be applied)
--   2. Run 20260221_discovery_heatmap_mvp.sql (creates discovery tables)
--   3. Run seed-demo-data.sql (creates tenant, users, cases)
--
-- IDEMPOTENT: Uses ON CONFLICT DO NOTHING for all inserts.
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 0.  ENSURE TENANT EXISTS (fallback if seed-demo-data.sql wasn't run)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "tenants" WHERE "id" = 'tenant_demo_1') THEN
    INSERT INTO "tenants" ("id", "name", "slaDefaultDays", "dueSoonDays", "retentionDays", "createdAt", "updatedAt")
    VALUES ('tenant_demo_1', 'Demo GmbH', 30, 7, 365, NOW(), NOW());
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1.  SYSTEMS (4 discovery-focused systems)
-- ═══════════════════════════════════════════════════════════════════════════
-- These use deterministic IDs prefixed with "sys_disc_" to avoid collision
-- with systems created by the Prisma seed.

INSERT INTO public."systems" (
  "id", "tenantId", "name", "description", "contactEmail",
  "criticality", "type", "connectorType", "automationReadiness",
  "inScopeForDsar", "dataResidencyPrimary",
  "identifierTypes", "exportFormats",
  "createdAt", "updatedAt"
) VALUES
  ('sys_disc_m365',       'tenant_demo_1', 'Microsoft 365',       'M365 tenant: SharePoint, OneDrive, Teams',               'it-admin@demo.de',    'HIGH',   'cloud_saas',  'M365',  'API_AVAILABLE', true, 'EU', ARRAY['email','employeeId'], ARRAY['json','csv','pdf'], NOW(), NOW()),
  ('sys_disc_fileserver', 'tenant_demo_1', 'Corporate Fileserver', 'On-premise Windows file server (\\\\fs01)',              'infra@demo.de',       'MEDIUM', 'on_premise',  'NONE',  'MANUAL',        true, 'EU', ARRAY['employeeId'],         ARRAY['csv'],              NOW(), NOW()),
  ('sys_disc_hrcrm',      'tenant_demo_1', 'HR-CRM',              'SAP SuccessFactors HR and CRM module',                   'hr-admin@demo.de',    'HIGH',   'cloud_saas',  'NONE',  'SEMI_AUTOMATED', true, 'EU', ARRAY['email','employeeId'], ARRAY['csv','pdf'],        NOW(), NOW()),
  ('sys_disc_exchange',   'tenant_demo_1', 'Exchange Online',      'Exchange Online mailboxes, calendars, and shared contacts', 'mail-admin@demo.de', 'HIGH',  'cloud_saas',  'M365',  'API_AVAILABLE', true, 'EU', ARRAY['email'],              ARRAY['json','pst'],       NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2.  DATA ASSETS (50 assets across 4 systems)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.data_assets (id, tenant_id, system_id, asset_type, asset_ref, path_or_url, title, last_seen_at, size_bytes, metadata_json)
VALUES
  -- ── M365 (14 assets: da_001 – da_014) ─────────────────────────────────
  ('da_001', 'tenant_demo_1', 'sys_disc_m365',       'sharepoint_doc',  'sp-doc-001', '/sites/hr/Shared Documents/Employee-Handbook-2026.docx',           'Employee Handbook 2026',              NOW() - INTERVAL '2 days',  2457600,  '{"author":"HR Team","version":"3.1"}'),
  ('da_002', 'tenant_demo_1', 'sys_disc_m365',       'sharepoint_doc',  'sp-doc-002', '/sites/hr/Shared Documents/Contracts/',                             'Customer Contracts Folder',            NOW() - INTERVAL '1 day',   0,        '{"itemCount":147}'),
  ('da_003', 'tenant_demo_1', 'sys_disc_m365',       'sharepoint_doc',  'sp-doc-003', '/sites/compliance/GDPR-Policy-v4.pdf',                              'GDPR Policy v4',                      NOW() - INTERVAL '5 days',  1048576,  '{"classification":"confidential"}'),
  ('da_004', 'tenant_demo_1', 'sys_disc_m365',       'sharepoint_doc',  'sp-doc-004', '/sites/hr/Recruitment/Applicant-Database-Export.xlsx',               'Recruitment Applicant Database',       NOW() - INTERVAL '3 days',  5242880,  '{"rowCount":892}'),
  ('da_005', 'tenant_demo_1', 'sys_disc_m365',       'onedrive_file',   'od-001',     '/personal/hr-director/Documents/Performance-Reviews-2025.xlsx',      'HR Director Performance Reviews',      NOW() - INTERVAL '7 days',  3145728,  '{"shared":false}'),
  ('da_006', 'tenant_demo_1', 'sys_disc_m365',       'onedrive_file',   'od-002',     '/personal/cfo/Documents/Q4-Salary-Report.xlsx',                     'CFO Q4 Salary Report',                NOW() - INTERVAL '4 days',  1572864,  '{"shared":true,"sharedWith":3}'),
  ('da_007', 'tenant_demo_1', 'sys_disc_m365',       'onedrive_file',   'od-003',     '/personal/marketing/Campaigns/Customer-Survey-Results.csv',          'Customer Feedback Survey Results',     NOW() - INTERVAL '2 days',  8388608,  '{"rowCount":4521}'),
  ('da_008', 'tenant_demo_1', 'sys_disc_m365',       'teams_chat',      'teams-001',  'teams://hr-channel/messages',                                       'HR Channel Chat History',              NOW() - INTERVAL '1 day',   0,        '{"messageCount":2847}'),
  ('da_009', 'tenant_demo_1', 'sys_disc_m365',       'teams_chat',      'teams-002',  'teams://customer-support/messages',                                 'Customer Support Channel',             NOW() - INTERVAL '1 day',   0,        '{"messageCount":15693}'),
  ('da_010', 'tenant_demo_1', 'sys_disc_m365',       'teams_chat',      'teams-003',  'teams://all-company/messages',                                      'All-Company Announcements',            NOW() - INTERVAL '1 day',   0,        '{"messageCount":523}'),
  ('da_011', 'tenant_demo_1', 'sys_disc_m365',       'sharepoint_doc',  'sp-doc-005', '/sites/legal/Vendor-Agreements/',                                   'Vendor Agreements Collection',         NOW() - INTERVAL '6 days',  0,        '{"itemCount":63}'),
  ('da_012', 'tenant_demo_1', 'sys_disc_m365',       'sharepoint_doc',  'sp-doc-006', '/sites/hr/Exit-Interviews/',                                        'Exit Interview Records',               NOW() - INTERVAL '10 days', 0,        '{"itemCount":31}'),
  ('da_013', 'tenant_demo_1', 'sys_disc_m365',       'onedrive_file',   'od-004',     '/personal/marketing/Campaign-Contacts-Export.xlsx',                  'Marketing Campaign Contact List',      NOW() - INTERVAL '3 days',  2097152,  '{"rowCount":12500}'),
  ('da_014', 'tenant_demo_1', 'sys_disc_m365',       'sharepoint_doc',  'sp-doc-007', '/sites/board/Meeting-Minutes-2025/',                                'Board Meeting Minutes 2025',           NOW() - INTERVAL '14 days', 0,        '{"itemCount":12}'),

  -- ── Fileserver (12 assets: da_015 – da_026) ───────────────────────────
  ('da_015', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-001',     '\\\\fs01\\HR\\Personnel-Files\\',                                   'Personnel Files Folder',               NOW() - INTERVAL '1 day',   0,        '{"fileCount":342}'),
  ('da_016', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-002',     '\\\\fs01\\Finance\\Payroll\\Payroll-Export-2026-01.xlsx',            'Payroll Export January 2026',          NOW() - INTERVAL '20 days', 4194304,  '{"rowCount":245}'),
  ('da_017', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-003',     '\\\\fs01\\HR\\ID-Copies\\',                                         'Scanned Employee ID Copies',           NOW() - INTERVAL '30 days', 0,        '{"fileCount":189}'),
  ('da_018', 'tenant_demo_1', 'sys_disc_fileserver',  'backup_archive',  'fs-004',     '\\\\fs01\\Backups\\CRM-DB-Backup-20260115.bak',                     'CRM Database Backup (Jan 2026)',       NOW() - INTERVAL '35 days', 536870912,'{"encrypted":false}'),
  ('da_019', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-005',     '\\\\fs01\\Legacy\\OldCRM-Export\\customers.csv',                    'Legacy CRM Customer Export',           NOW() - INTERVAL '90 days', 15728640, '{"rowCount":8934,"lastModified":"2024-06-01"}'),
  ('da_020', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-006',     '\\\\fs01\\HR\\Insurance\\Group-Health-Plan.xlsx',                   'Group Health Insurance Plan',          NOW() - INTERVAL '45 days', 1048576,  '{"rowCount":215}'),
  ('da_021', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-007',     '\\\\fs01\\Finance\\Travel-Expenses\\2025\\',                       'Travel Expense Reports 2025',          NOW() - INTERVAL '15 days', 0,        '{"fileCount":876}'),
  ('da_022', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-008',     '\\\\fs01\\HR\\Training\\Certificates\\',                            'Employee Training Certificates',       NOW() - INTERVAL '12 days', 0,        '{"fileCount":523}'),
  ('da_023', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-009',     '\\\\fs01\\IT\\Access-Logs\\vpn-access-2026.log',                    'VPN Access Logs 2026',                 NOW() - INTERVAL '1 day',   104857600,'{"lineCount":2456789}'),
  ('da_024', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-010',     '\\\\fs01\\Scans\\Printer-Output\\',                                 'Printer Scan Output Folder',           NOW() - INTERVAL '2 days',  0,        '{"fileCount":1247}'),
  ('da_025', 'tenant_demo_1', 'sys_disc_fileserver',  'network_file',    'fs-011',     '\\\\fs01\\Facility\\Badge-Access-Log-2026.csv',                     'Building Access Badge Logs',           NOW() - INTERVAL '1 day',   52428800, '{"rowCount":156000}'),
  ('da_026', 'tenant_demo_1', 'sys_disc_fileserver',  'backup_archive',  'fs-012',     '\\\\fs01\\Archive\\Projects-2024\\',                                'Archived Project Folders (2024)',       NOW() - INTERVAL '180 days',0,        '{"folderCount":47}'),

  -- ── HR-CRM (14 assets: da_027 – da_040) ───────────────────────────────
  ('da_027', 'tenant_demo_1', 'sys_disc_hrcrm',       'employee_record', 'hr-001',     'https://hr.demo.de/api/employees',                                  'Employee Master Data',                 NOW() - INTERVAL '1 day',   0,        '{"recordCount":245}'),
  ('da_028', 'tenant_demo_1', 'sys_disc_hrcrm',       'contract_doc',    'hr-002',     'https://hr.demo.de/documents/contracts',                             'Employment Contracts',                 NOW() - INTERVAL '3 days',  0,        '{"documentCount":245}'),
  ('da_029', 'tenant_demo_1', 'sys_disc_hrcrm',       'evaluation',      'hr-003',     'https://hr.demo.de/performance/reviews',                             'Performance Evaluations',              NOW() - INTERVAL '7 days',  0,        '{"reviewCount":198}'),
  ('da_030', 'tenant_demo_1', 'sys_disc_hrcrm',       'employee_record', 'hr-004',     'https://hr.demo.de/payroll/records',                                 'Salary & Compensation Records',        NOW() - INTERVAL '5 days',  0,        '{"recordCount":245}'),
  ('da_031', 'tenant_demo_1', 'sys_disc_hrcrm',       'employee_record', 'hr-005',     'https://hr.demo.de/recruiting/applicants',                           'Applicant Tracking Data',              NOW() - INTERVAL '2 days',  0,        '{"applicantCount":1847}'),
  ('da_032', 'tenant_demo_1', 'sys_disc_hrcrm',       'employee_record', 'hr-006',     'https://hr.demo.de/timetracking',                                    'Time Tracking Records',                NOW() - INTERVAL '1 day',   0,        '{"entryCount":48750}'),
  ('da_033', 'tenant_demo_1', 'sys_disc_hrcrm',       'employee_record', 'hr-007',     'https://hr.demo.de/benefits/enrollment',                             'Benefits Enrollment Data',             NOW() - INTERVAL '30 days', 0,        '{"enrollmentCount":230}'),
  ('da_034', 'tenant_demo_1', 'sys_disc_hrcrm',       'employee_record', 'hr-008',     'https://hr.demo.de/employees/emergency-contacts',                    'Emergency Contact Information',         NOW() - INTERVAL '14 days', 0,        '{"contactCount":490}'),
  ('da_035', 'tenant_demo_1', 'sys_disc_hrcrm',       'employee_record', 'hr-009',     'https://hr.demo.de/compliance/disciplinary',                         'Disciplinary Records',                 NOW() - INTERVAL '60 days', 0,        '{"recordCount":18}'),
  ('da_036', 'tenant_demo_1', 'sys_disc_hrcrm',       'employee_record', 'hr-010',     'https://hr.demo.de/training/history',                                'Training & Development History',       NOW() - INTERVAL '10 days', 0,        '{"completionCount":3245}'),
  ('da_037', 'tenant_demo_1', 'sys_disc_hrcrm',       'employee_record', 'hr-011',     'https://hr.demo.de/org/chart',                                       'Organizational Chart Data',            NOW() - INTERVAL '3 days',  0,        '{"nodeCount":245}'),
  ('da_038', 'tenant_demo_1', 'sys_disc_hrcrm',       'contract_doc',    'hr-012',     'https://hr.demo.de/onboarding/documents',                            'Employee Onboarding Documents',        NOW() - INTERVAL '5 days',  0,        '{"documentCount":735}'),
  ('da_039', 'tenant_demo_1', 'sys_disc_hrcrm',       'contact_record',  'hr-013',     'https://hr.demo.de/crm/contacts',                                    'Customer Contact Database',             NOW() - INTERVAL '1 day',   0,        '{"contactCount":12456}'),
  ('da_040', 'tenant_demo_1', 'sys_disc_hrcrm',       'contact_record',  'hr-014',     'https://hr.demo.de/crm/leads',                                       'Lead Management Records',              NOW() - INTERVAL '2 days',  0,        '{"leadCount":3847}'),

  -- ── Exchange (10 assets: da_041 – da_050) ─────────────────────────────
  ('da_041', 'tenant_demo_1', 'sys_disc_exchange',    'email_mailbox',   'ex-001',     'exchange://mailboxes/executives',                                    'Executive Mailboxes',                  NOW() - INTERVAL '1 day',   0,        '{"mailboxCount":8,"totalItems":45230}'),
  ('da_042', 'tenant_demo_1', 'sys_disc_exchange',    'email_mailbox',   'ex-002',     'exchange://mailboxes/hr@demo.de',                                    'HR Department Mailbox',                NOW() - INTERVAL '1 day',   0,        '{"totalItems":18456}'),
  ('da_043', 'tenant_demo_1', 'sys_disc_exchange',    'email_mailbox',   'ex-003',     'exchange://mailboxes/support@demo.de',                               'Support Inbox',                        NOW() - INTERVAL '1 day',   0,        '{"totalItems":67891}'),
  ('da_044', 'tenant_demo_1', 'sys_disc_exchange',    'email_mailbox',   'ex-004',     'exchange://distribution-lists/sales-all',                            'Sales Distribution List Archive',      NOW() - INTERVAL '3 days',  0,        '{"memberCount":45,"totalItems":8920}'),
  ('da_045', 'tenant_demo_1', 'sys_disc_exchange',    'email_mailbox',   'ex-005',     'exchange://mailboxes/complaints@demo.de',                            'Customer Complaint Emails',            NOW() - INTERVAL '1 day',   0,        '{"totalItems":3456}'),
  ('da_046', 'tenant_demo_1', 'sys_disc_exchange',    'calendar_entry',  'ex-006',     'exchange://calendars/hr-interviews',                                 'Interview Schedule Calendar',          NOW() - INTERVAL '2 days',  0,        '{"eventCount":127}'),
  ('da_047', 'tenant_demo_1', 'sys_disc_exchange',    'contact_list',    'ex-007',     'exchange://contacts/shared/customers',                               'Shared Contacts – Customers',          NOW() - INTERVAL '5 days',  0,        '{"contactCount":2341}'),
  ('da_048', 'tenant_demo_1', 'sys_disc_exchange',    'contact_list',    'ex-008',     'exchange://contacts/shared/vendors',                                 'Shared Contacts – Vendors',            NOW() - INTERVAL '5 days',  0,        '{"contactCount":189}'),
  ('da_049', 'tenant_demo_1', 'sys_disc_exchange',    'email_mailbox',   'ex-009',     'exchange://mailboxes/legal@demo.de',                                 'Legal Team Mailbox',                   NOW() - INTERVAL '1 day',   0,        '{"totalItems":12340}'),
  ('da_050', 'tenant_demo_1', 'sys_disc_exchange',    'email_mailbox',   'ex-010',     'exchange://mailboxes/finance@demo.de',                               'Finance Department Mailbox',            NOW() - INTERVAL '1 day',   0,        '{"totalItems":29876}')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3.  DISCOVERY FINDINGS (200 findings)
-- ═══════════════════════════════════════════════════════════════════════════
-- Distribution: ~140 green (0-30), ~40 yellow (31-60), ~20 red (61-100)
-- Status:       ~140 open, ~30 accepted, ~20 mitigated, ~10 false_positive
--
-- Uses generate_series with deterministic math for reproducible data.

INSERT INTO public.discovery_findings
  (id, tenant_id, data_asset_id, pii_category, pii_count, sensitivity_score, sample_redacted_text, status, created_at)
SELECT
  'df_' || lpad(i::text, 3, '0'),
  'tenant_demo_1',
  -- Distribute across 50 assets (each asset gets ~4 findings)
  'da_' || lpad((((i - 1) % 50) + 1)::text, 3, '0'),
  -- PII category: context-aware based on system
  CASE
    -- M365 assets (da_001 to da_014): mostly name, email, phone
    WHEN ((i - 1) % 50) + 1 <= 14 THEN
      (ARRAY['name','email','phone','address','name','email','phone','email','name','address'])[((i - 1) % 10) + 1]
    -- Fileserver assets (da_015 to da_026): more sensitive (IDs, salary)
    WHEN ((i - 1) % 50) + 1 <= 26 THEN
      (ARRAY['name','national_id','salary','address','email','bank_account','date_of_birth','phone','name','ip_address'])[((i - 1) % 10) + 1]
    -- HR-CRM assets (da_027 to da_040): most sensitive (salary, medical, tax)
    WHEN ((i - 1) % 50) + 1 <= 40 THEN
      (ARRAY['salary','name','date_of_birth','bank_account','national_id','medical_info','email','phone','address','tax_id'])[((i - 1) % 10) + 1]
    -- Exchange assets (da_041 to da_050): mostly email, name, phone
    ELSE
      (ARRAY['email','name','phone','address','email','name','email','phone','name','email'])[((i - 1) % 10) + 1]
  END,
  -- PII count: varies 1-500 per finding
  ((i * 7 + 13) % 500) + 1,
  -- Sensitivity score: 70% green, 20% yellow, 10% red
  CASE
    WHEN i <= 140 THEN ((i * 13 + 3) % 31)             -- 0-30 (green)
    WHEN i <= 180 THEN 31 + ((i * 17 + 5) % 30)        -- 31-60 (yellow)
    ELSE                61 + ((i * 23 + 7) % 40)        -- 61-100 (red)
  END,
  -- Sample redacted text
  CASE ((i - 1) % 8)
    WHEN 0 THEN 'M*** S***@example.com'
    WHEN 1 THEN 'Hans M***'
    WHEN 2 THEN '+49 170 ***-****'
    WHEN 3 THEN 'Musterstr. **, 1**** Berlin'
    WHEN 4 THEN 'DE** **** **** **** ** (IBAN)'
    WHEN 5 THEN '19**-**-** (DOB)'
    WHEN 6 THEN '***-**-**** (SSN/ID)'
    WHEN 7 THEN '192.168.***.***'
  END,
  -- Status: 70% open, 15% accepted, 10% mitigated, 5% false_positive
  CASE
    WHEN i <= 140 THEN 'open'
    WHEN i <= 170 THEN 'accepted'
    WHEN i <= 190 THEN 'mitigated'
    ELSE               'false_positive'
  END,
  -- Stagger creation dates over last 14 days
  NOW() - ((i % 14) || ' days')::interval
FROM generate_series(1, 200) AS i
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4.  SCAN JOBS (8 jobs: 2 per system)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.scan_jobs
  (id, tenant_id, system_id, status, started_at, finished_at, stats_json, error_text, created_at)
VALUES
  -- M365: one done, one running
  ('sj_001', 'tenant_demo_1', 'sys_disc_m365',       'done',    NOW() - INTERVAL '3 days',  NOW() - INTERVAL '3 days' + INTERVAL '47 minutes',
   '{"assetsScanned":14,"findingsTotal":56,"green":42,"yellow":10,"red":4}', NULL, NOW() - INTERVAL '3 days'),
  ('sj_002', 'tenant_demo_1', 'sys_disc_m365',       'running', NOW() - INTERVAL '15 minutes', NULL,
   '{"assetsScanned":6,"findingsTotal":0}', NULL, NOW() - INTERVAL '15 minutes'),

  -- Fileserver: one done, one failed
  ('sj_003', 'tenant_demo_1', 'sys_disc_fileserver',  'done',    NOW() - INTERVAL '5 days',  NOW() - INTERVAL '5 days' + INTERVAL '2 hours 13 minutes',
   '{"assetsScanned":12,"findingsTotal":48,"green":30,"yellow":12,"red":6}', NULL, NOW() - INTERVAL '5 days'),
  ('sj_004', 'tenant_demo_1', 'sys_disc_fileserver',  'failed',  NOW() - INTERVAL '1 day',   NOW() - INTERVAL '1 day' + INTERVAL '3 minutes',
   '{"assetsScanned":2,"findingsTotal":0}', 'Connection refused: \\\\fs01 unreachable (timeout after 180s)', NOW() - INTERVAL '1 day'),

  -- HR-CRM: one done, one queued
  ('sj_005', 'tenant_demo_1', 'sys_disc_hrcrm',       'done',    NOW() - INTERVAL '2 days',  NOW() - INTERVAL '2 days' + INTERVAL '35 minutes',
   '{"assetsScanned":14,"findingsTotal":56,"green":28,"yellow":18,"red":10}', NULL, NOW() - INTERVAL '2 days'),
  ('sj_006', 'tenant_demo_1', 'sys_disc_hrcrm',       'queued',  NULL, NULL,
   '{}', NULL, NOW() - INTERVAL '5 minutes'),

  -- Exchange: two done
  ('sj_007', 'tenant_demo_1', 'sys_disc_exchange',    'done',    NOW() - INTERVAL '4 days',  NOW() - INTERVAL '4 days' + INTERVAL '1 hour 22 minutes',
   '{"assetsScanned":10,"findingsTotal":40,"green":32,"yellow":6,"red":2}', NULL, NOW() - INTERVAL '4 days'),
  ('sj_008', 'tenant_demo_1', 'sys_disc_exchange',    'done',    NOW() - INTERVAL '1 day',   NOW() - INTERVAL '1 day' + INTERVAL '58 minutes',
   '{"assetsScanned":10,"findingsTotal":40,"green":30,"yellow":7,"red":3}', NULL, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5.  DSAR CASE ITEMS (~40 items linking cases to data assets)
-- ═══════════════════════════════════════════════════════════════════════════
-- Links the 20 DSAR cases (from seed-demo-data.sql) to relevant data assets.
-- Only inserts if the referenced case exists (guard against missing seed data).

DO $$
BEGIN
  -- Only proceed if the demo cases exist
  IF EXISTS (SELECT 1 FROM "dsar_cases" WHERE "id" = 'case_01') THEN

    INSERT INTO public.dsar_case_items
      (id, tenant_id, dsar_case_id, data_asset_id, decision, reason, exported_at, created_at)
    VALUES
      -- Case 01 (ACCESS, DATA_COLLECTION): HR and M365 data
      ('dci_001', 'tenant_demo_1', 'case_01', 'da_027', 'include', 'Employee master data contains subject records',        NULL, NOW() - INTERVAL '20 days'),
      ('dci_002', 'tenant_demo_1', 'case_01', 'da_001', 'include', 'Handbook references subject by name',                  NULL, NOW() - INTERVAL '20 days'),
      ('dci_003', 'tenant_demo_1', 'case_01', 'da_042', 'include', 'HR mailbox contains correspondence with subject',      NULL, NOW() - INTERVAL '18 days'),

      -- Case 02 (ERASURE, DATA_COLLECTION): broad search
      ('dci_004', 'tenant_demo_1', 'case_02', 'da_039', 'include', 'CRM customer database contains subject profile',       NULL, NOW() - INTERVAL '18 days'),
      ('dci_005', 'tenant_demo_1', 'case_02', 'da_019', 'include', 'Legacy CRM export includes subject data',              NULL, NOW() - INTERVAL '17 days'),
      ('dci_006', 'tenant_demo_1', 'case_02', 'da_047', 'include', 'Shared contacts list includes subject',                NULL, NOW() - INTERVAL '17 days'),
      ('dci_007', 'tenant_demo_1', 'case_02', 'da_018', 'exclude', 'Backup encrypted, subject data not individually extractable', NULL, NOW() - INTERVAL '16 days'),

      -- Case 03 (ACCESS, REVIEW_LEGAL): legal review of exemptions
      ('dci_008', 'tenant_demo_1', 'case_03', 'da_030', 'include', 'Salary records requested by subject',                  NULL, NOW() - INTERVAL '15 days'),
      ('dci_009', 'tenant_demo_1', 'case_03', 'da_005', 'exclude', 'Performance review contains third-party opinions (Art. 15(4) exemption)', NULL, NOW() - INTERVAL '12 days'),

      -- Case 04 (PORTABILITY, REVIEW_LEGAL)
      ('dci_010', 'tenant_demo_1', 'case_04', 'da_027', 'include', 'Employee master data for portability export',           NULL, NOW() - INTERVAL '14 days'),
      ('dci_011', 'tenant_demo_1', 'case_04', 'da_032', 'include', 'Time tracking records (machine-readable format)',       NULL, NOW() - INTERVAL '13 days'),

      -- Case 05 (RECTIFICATION, DATA_COLLECTION): address correction
      ('dci_012', 'tenant_demo_1', 'case_05', 'da_027', 'include', 'Master data address field needs correction',            NULL, NOW() - INTERVAL '12 days'),
      ('dci_013', 'tenant_demo_1', 'case_05', 'da_034', 'include', 'Emergency contacts contain outdated address',           NULL, NOW() - INTERVAL '12 days'),

      -- Case 06 (ACCESS, DATA_COLLECTION)
      ('dci_014', 'tenant_demo_1', 'case_06', 'da_043', 'include', 'Support inbox contains tickets from subject',           NULL, NOW() - INTERVAL '10 days'),
      ('dci_015', 'tenant_demo_1', 'case_06', 'da_039', 'include', 'CRM has subject contact record',                        NULL, NOW() - INTERVAL '10 days'),

      -- Case 07 (ERASURE, DATA_COLLECTION)
      ('dci_016', 'tenant_demo_1', 'case_07', 'da_013', 'include', 'Marketing campaign list contains subject email',        NULL, NOW() - INTERVAL '9 days'),
      ('dci_017', 'tenant_demo_1', 'case_07', 'da_044', 'include', 'Sales distribution list includes subject',              NULL, NOW() - INTERVAL '9 days'),

      -- Case 08 (ACCESS, REVIEW_LEGAL): redaction review
      ('dci_018', 'tenant_demo_1', 'case_08', 'da_045', 'include', 'Complaint emails from subject',                         NULL, NOW() - INTERVAL '8 days'),
      ('dci_019', 'tenant_demo_1', 'case_08', 'da_049', 'exclude', 'Legal privileged communications (Art. 15(4))',           NULL, NOW() - INTERVAL '6 days'),

      -- Case 09 (OBJECTION, DATA_COLLECTION)
      ('dci_020', 'tenant_demo_1', 'case_09', 'da_007', 'include', 'Survey results include subject responses',              NULL, NOW() - INTERVAL '7 days'),

      -- Case 10 (ACCESS, DATA_COLLECTION)
      ('dci_021', 'tenant_demo_1', 'case_10', 'da_041', 'include', 'Executive mailbox contains emails mentioning subject',   NULL, NOW() - INTERVAL '5 days'),
      ('dci_022', 'tenant_demo_1', 'case_10', 'da_050', 'include', 'Finance mailbox has invoices referencing subject',       NULL, NOW() - INTERVAL '5 days'),

      -- Case 11 (ACCESS, DATA_COLLECTION)
      ('dci_023', 'tenant_demo_1', 'case_11', 'da_036', 'include', 'Training history for subject',                          NULL, NOW() - INTERVAL '4 days'),

      -- Case 12 (ERASURE, REVIEW_LEGAL): retention check
      ('dci_024', 'tenant_demo_1', 'case_12', 'da_016', 'exclude', 'Payroll data under 6-year tax retention obligation',     NULL, NOW() - INTERVAL '3 days'),
      ('dci_025', 'tenant_demo_1', 'case_12', 'da_028', 'exclude', 'Employment contract under legal retention period',       NULL, NOW() - INTERVAL '3 days'),

      -- Case 13 (RESTRICTION, REVIEW_LEGAL)
      ('dci_026', 'tenant_demo_1', 'case_13', 'da_031', 'include', 'Applicant data processing to be restricted',            NULL, NOW() - INTERVAL '2 days'),

      -- Case 14 (ACCESS, DATA_COLLECTION)
      ('dci_027', 'tenant_demo_1', 'case_14', 'da_029', 'include', 'Performance evaluation records',                        NULL, NOW() - INTERVAL '2 days'),
      ('dci_028', 'tenant_demo_1', 'case_14', 'da_033', 'include', 'Benefits enrollment data',                              NULL, NOW() - INTERVAL '2 days'),

      -- Case 15 (PORTABILITY, DATA_COLLECTION)
      ('dci_029', 'tenant_demo_1', 'case_15', 'da_027', 'include', 'Master data export (JSON format)',                       NULL, NOW() - INTERVAL '1 day'),

      -- Case 16 (ACCESS, CLOSED): fully exported
      ('dci_030', 'tenant_demo_1', 'case_16', 'da_027', 'include', 'Employee data provided',                                NOW() - INTERVAL '8 days', NOW() - INTERVAL '20 days'),
      ('dci_031', 'tenant_demo_1', 'case_16', 'da_042', 'include', 'HR correspondence exported',                             NOW() - INTERVAL '8 days', NOW() - INTERVAL '20 days'),

      -- Case 17 (ERASURE, CLOSED): data deleted
      ('dci_032', 'tenant_demo_1', 'case_17', 'da_039', 'include', 'CRM record deleted',                                    NOW() - INTERVAL '5 days', NOW() - INTERVAL '18 days'),
      ('dci_033', 'tenant_demo_1', 'case_17', 'da_047', 'include', 'Shared contact entry removed',                           NOW() - INTERVAL '5 days', NOW() - INTERVAL '18 days'),

      -- Case 18 (ACCESS, CLOSED): data exported
      ('dci_034', 'tenant_demo_1', 'case_18', 'da_043', 'include', 'Support tickets exported',                               NOW() - INTERVAL '4 days', NOW() - INTERVAL '15 days'),
      ('dci_035', 'tenant_demo_1', 'case_18', 'da_040', 'include', 'Lead record exported',                                   NOW() - INTERVAL '4 days', NOW() - INTERVAL '15 days'),

      -- Case 19 (OBJECTION, REJECTED): no items exported
      ('dci_036', 'tenant_demo_1', 'case_19', 'da_007', 'exclude', 'Objection rejected — legitimate interest prevails',      NULL, NOW() - INTERVAL '16 days'),

      -- Case 20 (ERASURE, REJECTED): retention obligation
      ('dci_037', 'tenant_demo_1', 'case_20', 'da_016', 'exclude', 'Tax retention obligation (6 years, until 2029)',          NULL, NOW() - INTERVAL '14 days'),
      ('dci_038', 'tenant_demo_1', 'case_20', 'da_030', 'exclude', 'Salary data under retention — erasure deferred',         NULL, NOW() - INTERVAL '14 days')
    ON CONFLICT (id) DO NOTHING;

  ELSE
    RAISE NOTICE 'Skipping dsar_case_items: demo cases not found. Run seed-demo-data.sql first.';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6.  VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Asset count per system
SELECT s."name" AS system_name, COUNT(da.id)::int AS asset_count
FROM public."systems" s
JOIN public.data_assets da ON da.system_id = s.id
WHERE s.id LIKE 'sys_disc_%'
GROUP BY s."name"
ORDER BY s."name";

-- Finding distribution by severity band
SELECT
  CASE
    WHEN sensitivity_score <= 30 THEN 'green (0-30)'
    WHEN sensitivity_score <= 60 THEN 'yellow (31-60)'
    ELSE                              'red (61-100)'
  END AS severity_band,
  COUNT(*)::int AS cnt
FROM public.discovery_findings
WHERE tenant_id = 'tenant_demo_1'
GROUP BY severity_band
ORDER BY severity_band;

-- Finding status distribution
SELECT status, COUNT(*)::int AS cnt
FROM public.discovery_findings
WHERE tenant_id = 'tenant_demo_1'
GROUP BY status
ORDER BY cnt DESC;

-- Scan jobs
SELECT sj.status, s."name" AS system_name
FROM public.scan_jobs sj
JOIN public."systems" s ON s.id = sj.system_id
WHERE sj.tenant_id = 'tenant_demo_1'
ORDER BY s."name", sj.created_at;

-- DSAR case items
SELECT COUNT(*)::int AS case_item_count
FROM public.dsar_case_items
WHERE tenant_id = 'tenant_demo_1';

COMMIT;
