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
  - 13 new tests (32 → 45 total):
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
