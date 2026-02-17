# Release Notes — Sprint 9.8

**Date**: 2026-02-17
**Type**: Feature Sprint — Compliance Evidence Pack

## Summary

Sprint 9.8 implements a complete Compliance Evidence Pack module for PrivacyPilot.
The module auto-generates compliance evidence packs for ISO 27001, SOC 2, GDPR,
and Vendor Due Diligence questionnaires by inspecting actual system state. It includes
18+ automated evidence checkers, HTML/JSON export, RBAC enforcement, and full audit logging.

## Changes

### New Features

- **Compliance Evidence Pack Module** (Module 9.8)
  - 4 new Prisma models: `ComplianceFramework`, `ComplianceControl`, `ComplianceEvidenceRun`, `ComplianceFinding`
  - 3 new enums: `ComplianceFrameworkType`, `ComplianceRunStatus`, `ComplianceControlStatus`
  - ComplianceEngine with 18+ automated evidence checkers (`src/lib/compliance-engine.ts`)
  - ComplianceExportService for JSON + HTML report generation (`src/lib/compliance-export.ts`)
  - API routes at `/api/governance/compliance` with GET (frameworks/runs/findings) and POST (assess/export)
  - Governance UI page at `/governance/compliance`
  - Sidebar navigation entry under "Compliance"

- **Compliance Frameworks Seed Data** (`prisma/seed.ts`)
  - ISO/IEC 27001:2022 — 5 controls (A.5.1, A.5.15, A.5.30, A.8.12, A.8.16)
  - SOC 2 Type II — 3 controls (CC6.1, CC7.2, CC8.1)
  - GDPR 2016/679 — 5 controls (Art. 5(2), Art. 24, Art. 30, Art. 32, Art. 33)
  - Vendor Due Diligence v1.0 — 5 controls (VDD-01 through VDD-05)
  - Each control mapped to relevant evidence source checkers

### Evidence Checkers

| Checker | System Feature |
|---|---|
| `audit_log` | AuditLog entries |
| `assurance_audit_log` | Tamper-evident hash chain |
| `access_logs` | Resource access logging |
| `sod_policy` | Separation of duties |
| `retention_policy` | Data retention policies |
| `deletion_jobs` | Automated deletion |
| `deletion_events` | Deletion records |
| `feature_flags` | Feature flag governance |
| `rbac` | Role-based access control |
| `incident_management` | Incident records |
| `incident_export` | Authority notification exports |
| `vendor_management` | Vendor/processor registry |
| `vendor_requests` | Vendor data requests |
| `dsar_cases` | DSAR case management |
| `data_inventory` | System/processing registry |
| `encryption` | TLS/encryption configuration |
| `idv_system` | Identity verification |
| `response_templates` | Standardized response templates |
| `connectors` | Automated data collection |
| `monitoring` | Health/readiness probes |

### Documentation

- **`docs/compliance_mapping.md`** — Control-to-evidence-source mapping
- **`docs/evidence_pack_usage.md`** — Usage guide for auditors and developers
- **`docs/validation_report.md`** — Updated with Sprint 9.8 test results
- **`docs/release_notes.md`** — This file

## Breaking Changes

None.

## Migration Notes

- Run `npx prisma generate` to regenerate the Prisma client with new models
- Run `npx prisma db push` or create a migration for the 4 new tables
- Run `npm run db:seed` to seed the compliance frameworks and controls
- No env var changes required

## RBAC Permissions

| Action | Permission | Roles |
|---|---|---|
| View frameworks & runs | `GOVERNANCE_VIEW` | SUPER_ADMIN, TENANT_ADMIN, DPO |
| Run assessments | `GOVERNANCE_EXPORT_REPORT` | SUPER_ADMIN, TENANT_ADMIN, DPO |
| Export HTML/JSON | `GOVERNANCE_EXPORT_REPORT` | SUPER_ADMIN, TENANT_ADMIN, DPO |

## Test Statistics

| Metric | Before (9.7) | After (9.8) | Delta |
|---|---|---|---|
| Unit test files | 34 | 35 | +1 |
| Total unit tests | 1,872 | 1,896 | +24 |
| Smoke validation tests | 45 | 45 | — |
| Playwright E2E tests | 13 | 13 | — |
| TODO/FIXME markers | 0 | 0 | — |
| Open risks (medium+) | 0 | 0 | — |

## Verification

```bash
# Full validation (lint + typecheck + all tests)
npm run validate

# Compliance tests only
npx vitest run tests/unit/compliance.test.ts

# Seed with compliance frameworks
npm run db:seed

# E2E (requires running server + DB)
npm run test:e2e
```

---

# Release Notes — Sprint 9.7

**Date**: 2026-02-17
**Type**: Cleanup / Stabilization Sprint

## Summary

Sprint 9.7 closes all open items from the Sprint 9.6 validation report,
resolves the last TODO in the codebase, adds a second tenant for cross-tenant
E2E testing, and brings the total test count to 1,872 passing tests.

## Changes

### Fixes

- **S3 Storage Implementation** (`src/lib/storage.ts`)
  - Replaced the `TODO: Implement real S3 upload` stub with a working `@aws-sdk/client-s3` implementation
  - `PutObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand` via dynamic import
  - Graceful fallback to local storage when `S3_BUCKET` is not configured or on S3 errors
  - SHA-256 checksum verification on upload
  - Zero TODOs/FIXMEs/HACKs remaining in the codebase

### Improvements

- **Second Tenant Seed Data** (`prisma/seed.ts`)
  - Added "Beta Industries" tenant (`slug: beta-industries`)
  - 2 users: TENANT_ADMIN + READ_ONLY (password: `beta123456`)
  - 1 system (Beta ERP), 1 data subject, 1 case (`BETA-2026-0001`)
  - SLA config + intake settings for tenant2
  - Enables cross-tenant isolation E2E tests

- **Expanded Smoke Test Suite** (`tests/unit/smoke-validation.test.ts`)
  - 13 new tests (32 -> 45 total):
    - Storage provider: upload/download roundtrip, method exports
    - RBAC completeness: role hierarchy monotonicity, delivery/assurance/search permissions
    - Rate limiter: exports, IP hash consistency, non-reversibility
    - Pagination: defaults, custom values, invalid input handling

- **E2E Test Infrastructure** (`tests/e2e/helpers/`)
  - Added `TENANT2_USERS` constant with Beta Industries credentials
  - Added `Tenant2ApiClient` class for cross-tenant E2E API testing
  - Added `getAuthCookiesTenant2()` helper
  - Refactored login into shared `apiLogin()` to reduce duplication

### Documentation

- **`docs/tech_debt.md`** — New: tracks 2 accepted trade-offs (dual RBAC API, S3 fallback)
- **`docs/release_notes.md`** — This file
- **`docs/validation_report.md`** — Updated with Sprint 9.7 results
- **`docs/qa_checklist.md`** — Already updated in Sprint 9.6

## Breaking Changes

None.

## Migration Notes

- Re-run seed to get the second tenant: `npm run db:seed`
- No schema changes; no Prisma migration needed
- New env vars for S3 (optional):
  - `S3_BUCKET` — S3 bucket name (required for S3 mode)
  - `S3_REGION` — S3 region (defaults to `eu-central-1`)

## Test Statistics

| Metric | Before (9.6) | After (9.7) | Delta |
|---|---|---|---|
| Unit test files | 34 | 34 | — |
| Total unit tests | 1,859 | 1,872 | +13 |
| Smoke validation tests | 32 | 45 | +13 |
| Playwright E2E tests | 13 | 13 | — |
| TODO/FIXME markers | 1 | 0 | -1 |
| Open risks (medium+) | 1 | 0 | -1 |

## Verification

```bash
# Full validation (lint + typecheck + all tests)
npm run validate

# Smoke tests only
npm run test:smoke

# Seed with second tenant
npm run db:seed

# E2E (requires running server + DB)
npm run test:e2e
```
