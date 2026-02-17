# Compliance Control Mapping

**Last updated**: 2026-02-17 (Sprint 9.8)

This document maps compliance framework controls to PrivacyPilot system features that serve as evidence sources.

## Evidence Source Registry

| Evidence Source Key | System Feature | What It Checks |
|---|---|---|
| `audit_log` | `AuditLog` table | Entries exist for tenant |
| `assurance_audit_log` | `AssuranceAuditLog` table | Tamper-evident hash chain entries exist |
| `access_logs` | `AccessLog` table | Resource access logging entries exist |
| `sod_policy` | `SodPolicy` table | Separation of duties policy exists and is enabled |
| `retention_policy` | `RetentionPolicy` table | Data retention policies are defined |
| `deletion_jobs` | `DeletionJob` table | Automated deletion jobs are configured |
| `deletion_events` | `DeletionEvent` table | Deletion events have been recorded |
| `feature_flags` | `FeatureFlag` table | Feature flag governance is active |
| `rbac` | `User` table (roles) | Multiple RBAC roles are in use |
| `incident_management` | `Incident` table | Incident management system has recorded incidents |
| `incident_export` | `AuthorityExportRun` table | Authority notification exports have been executed |
| `vendor_management` | `Vendor` table | Vendors/processors are registered |
| `vendor_requests` | `VendorRequest` table | Vendor data requests are tracked |
| `dsar_cases` | `DSARCase` table | DSAR case management is active |
| `data_inventory` | `System` table | Systems/processing activities are registered |
| `encryption` | Environment config | TLS/HTTPS is configured |
| `idv_system` | `IdvSettings` table | Identity verification is configured for tenant |
| `response_templates` | `ResponseTemplate` table | Standardized response templates exist |
| `connectors` | `Connector` table | System connectors for automated data collection |
| `monitoring` | System-level | Health/readiness probes and metrics are active |

## ISO 27001:2022

| Control ID | Title | Evidence Sources |
|---|---|---|
| A.5.1 | Policies for information security | `sod_policy`, `feature_flags`, `rbac` |
| A.5.15 | Access control | `rbac`, `access_logs`, `idv_system` |
| A.5.30 | ICT readiness for business continuity | `monitoring`, `connectors` |
| A.8.12 | Data classification and retention | `retention_policy`, `deletion_jobs`, `deletion_events` |
| A.8.16 | Monitoring activities | `audit_log`, `assurance_audit_log`, `access_logs`, `monitoring` |

## SOC 2 Type II (AICPA TSC)

| Control ID | Title | Evidence Sources |
|---|---|---|
| CC6.1 | Logical and physical access controls | `rbac`, `access_logs`, `idv_system`, `sod_policy` |
| CC7.2 | Monitoring of system components | `audit_log`, `assurance_audit_log`, `monitoring`, `incident_management` |
| CC8.1 | Change management | `feature_flags`, `audit_log`, `sod_policy` |

## GDPR (EU 2016/679)

| Control ID | Title | Evidence Sources |
|---|---|---|
| Art. 5(2) | Accountability principle | `audit_log`, `assurance_audit_log`, `dsar_cases` |
| Art. 24 | Responsibility of the controller | `rbac`, `sod_policy`, `feature_flags`, `data_inventory` |
| Art. 30 | Records of processing activities | `data_inventory`, `vendor_management`, `dsar_cases` |
| Art. 32 | Security of processing | `encryption`, `rbac`, `access_logs`, `audit_log` |
| Art. 33 | Notification of personal data breach | `incident_management`, `incident_export` |

## Vendor Due Diligence Questionnaire

| Control ID | Title | Evidence Sources |
|---|---|---|
| VDD-01 | Data segregation | `data_inventory`, `rbac` |
| VDD-02 | Encryption at rest and in transit | `encryption` |
| VDD-03 | Access controls and authentication | `rbac`, `access_logs`, `idv_system`, `sod_policy` |
| VDD-04 | Incident response procedures | `incident_management`, `incident_export` |
| VDD-05 | Audit logging and monitoring | `audit_log`, `assurance_audit_log`, `access_logs`, `monitoring` |

## Status Evaluation Logic

Each control is evaluated by checking all of its mapped evidence sources:

1. Each evidence source is checked independently by an `EvidenceChecker` function
2. Results are aggregated using worst-case logic:
   - If **any** source returns `MISSING` → overall status is `MISSING`
   - If **any** source returns `PARTIAL` (but none `MISSING`) → overall status is `PARTIAL`
   - If **all** sources return `COMPLIANT` → overall status is `COMPLIANT`
3. Notes from all checkers are concatenated with semicolons

## Score Formula

```
score = round(((compliant + partial * 0.5) / total) * 100)
```

- `COMPLIANT` controls count as 1.0
- `PARTIAL` controls count as 0.5
- `MISSING` controls count as 0.0
- Score is 0 if there are zero total controls

## Adding New Controls

1. Add the control to the appropriate framework in `prisma/seed.ts`
2. Map evidence sources in the `evidenceSourcesJson` array
3. If needed, add a new `EvidenceChecker` in `src/lib/compliance-engine.ts`
4. Re-run seed: `npm run db:seed`
5. Update this mapping document
