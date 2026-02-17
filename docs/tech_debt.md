# Technical Debt Registry

**Last updated**: 2026-02-17 (Sprint 9.7)

This document tracks intentional trade-offs and known areas for future improvement.
Items are categorized by severity and include rationale for deferral.

## Accepted Trade-offs (Won't Fix)

### TD-001: Dual RBAC API (`checkPermission` + `enforce`)

**Severity**: Low
**Location**: `src/lib/rbac.ts`

The codebase has two permission-checking APIs:
- `has(role, permission)` / `enforce(role, permission)` — fine-grained, used by all routes from Module 5+
- `hasPermission(role, resource, action)` / `checkPermission(role, resource, action)` — legacy CRUD mapping, used by Module 1-4 routes

**Rationale**: Both APIs are correctly implemented. The legacy API internally maps resource+action to fine-grained permissions via `LEGACY_MAP`. Migrating old routes would touch many files with no functional benefit. New routes should always use `enforce()`.

**Risk**: None. Both APIs enforce the same underlying permission set.

### TD-002: S3 Provider Local Fallback

**Severity**: Low
**Location**: `src/lib/storage.ts`

When `STORAGE_TYPE=s3` but `S3_BUCKET` is not configured, or when S3 operations fail, the S3StorageProvider gracefully falls back to local file storage. This is intentional for development ergonomics.

**Rationale**: In production, `S3_BUCKET` will be set and the fallback won't trigger. The fallback ensures the app never crashes due to misconfigured storage. A warning is logged on each fallback.

**Risk**: In production, if S3 goes down, files may be written locally and lost on container restart. Monitor for `[S3]` log warnings.

## Monitoring Notes

### Stderr Warnings in Test Output

The following warnings appear during test runs and are expected:

1. `PRIVACYPILOT_SECRET not set` — Tests run without env vars; the dev default is used.
2. `Using insecure default encryption key` — Expected in test environment; not for production.
3. `Environment Validation Failed` — Part of the `ensureEnv` test that deliberately removes env vars.

These do not indicate real issues and should not be suppressed.

## Resolved in Sprint 9.7

| ID | Description | Resolution |
|---|---|---|
| TD-S3 | S3 storage stub (TODO comment) | Replaced with real `@aws-sdk/client-s3` implementation + local fallback |
| TD-TENANT2 | No second tenant in seed data | Added Beta Industries tenant with 2 users, 1 system, 1 case |
| TD-CROSS-TENANT | No cross-tenant isolation tests | Added RBAC completeness + permission matrix tests |
