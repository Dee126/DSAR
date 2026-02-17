# Evidence Pack Usage Guide

**Last updated**: 2026-02-17 (Sprint 9.8)

## Overview

The Compliance Evidence Pack module automatically evaluates your organization's compliance posture against industry frameworks (ISO 27001, SOC 2, GDPR, Vendor Due Diligence) by inspecting actual system state. It generates exportable evidence reports suitable for auditors, regulators, and vendor assessments.

## Quick Start

1. Navigate to **Governance > Compliance** in the sidebar
2. Select a compliance framework from the dropdown
3. Click **Run Assessment**
4. Review the findings in the controls table
5. Export as HTML (for auditors) or JSON (for automation)

## Running an Assessment

### Via UI

1. Go to `/governance/compliance`
2. Select a framework (e.g., "ISO 27001 v2022")
3. Click **Run Assessment** — the engine will inspect system state
4. Results appear automatically in the findings table

### Via API

```bash
# Run assessment
curl -X POST /api/governance/compliance \
  -H "Content-Type: application/json" \
  -d '{"action": "run_assessment", "frameworkId": "<framework-uuid>"}'

# Response: { "runId": "...", "result": { ... } }
```

## Understanding Results

### Status Indicators

| Status | Meaning | Color |
|---|---|---|
| **COMPLIANT** | All evidence sources confirm the control is satisfied | Green |
| **PARTIAL** | Some evidence exists but coverage is incomplete | Yellow |
| **MISSING** | No evidence found; control requirement is not met | Red |

### Score Calculation

The overall compliance score is calculated as:

```
Score = ((Compliant + Partial * 0.5) / Total Controls) * 100
```

- A score of **80%+** is generally considered good
- A score of **50-79%** indicates areas needing attention
- A score below **50%** requires immediate action

## Exporting Evidence Packs

### HTML Report

Best for sharing with auditors and management. Includes:
- Executive summary with score card
- Detailed controls table with status badges
- System security architecture overview
- Disclaimer and metadata

```bash
curl -X POST /api/governance/compliance \
  -H "Content-Type: application/json" \
  -d '{"action": "export_html", "runId": "<run-uuid>"}'
```

### JSON Export

Best for automated processing and integration with GRC tools. Contains:
- Machine-readable meta, summary, controls, and systemInfo sections
- Same data as HTML but in structured format

```bash
curl -X POST /api/governance/compliance \
  -H "Content-Type: application/json" \
  -d '{"action": "export_json", "runId": "<run-uuid>"}'
```

## Privacy Guarantees

All evidence packs are designed to be **PII-free**:

- No personal names, email addresses, or identifiers are included
- Control evidence notes reference system capabilities, not individual records
- System info section reports aggregate counts only
- Tenant name is included for organizational context

## RBAC Requirements

| Action | Required Permission | Minimum Role |
|---|---|---|
| View frameworks & runs | `GOVERNANCE_VIEW` | DPO |
| Run assessments | `GOVERNANCE_EXPORT_REPORT` | TENANT_ADMIN |
| Export HTML/JSON | `GOVERNANCE_EXPORT_REPORT` | TENANT_ADMIN |

## Supported Frameworks

| Framework | Version | Controls |
|---|---|---|
| ISO/IEC 27001 | 2022 | 5 core controls |
| SOC 2 Type II | 2017 | 3 trust criteria |
| GDPR | 2016/679 | 5 articles |
| Vendor Due Diligence | 1.0 | 5 assessment areas |

## Audit Trail

Every compliance action is logged to the `AuditLog` table:

- `COMPLIANCE_ASSESSMENT_RUN` — Assessment was executed
- `COMPLIANCE_EXPORT_JSON` — JSON export was generated
- `COMPLIANCE_EXPORT_HTML` — HTML report was generated

## Troubleshooting

### No frameworks shown
Run `npm run db:seed` to seed the compliance frameworks and controls.

### All controls show PARTIAL
This typically means the tenant has the system configured but no data has been created yet (e.g., no audit log entries, no cases). Create some operational data first.

### Assessment takes too long
Each evidence checker runs a database query. For tenants with very large datasets, ensure database indexes are in place (they are created automatically by Prisma).

## For Developers

See `docs/compliance_mapping.md` for the full control-to-evidence-source mapping and instructions on adding new controls or frameworks.

Key files:
- `src/lib/compliance-engine.ts` — Evidence checkers and assessment runner
- `src/lib/compliance-export.ts` — JSON and HTML export generators
- `src/app/api/governance/compliance/route.ts` — API endpoints
- `src/app/(dashboard)/governance/compliance/page.tsx` — UI page
- `prisma/schema.prisma` — Data models (search for "Module 9.8")
- `tests/unit/compliance.test.ts` — Unit tests
