# Rollback Runbook

## When to Roll Back

- New deployment introduces a P1/P2 bug
- Health probes fail after deployment
- Significant error rate increase in `/api/metrics`
- Data integrity issue detected

## Rollback Options

### Option 1: Application Rollback (Code Only)

Revert to the previous application version without touching the database.

```bash
# 1. Identify the last known good commit
git log --oneline -10

# 2. Deploy previous version
git checkout <good-commit>
npm ci
npm run build
npm start

# Or if using container images:
# docker pull registry/privacy-pilot:<previous-tag>
# docker-compose up -d
```

**When to use**: Bug is in application code only, no schema changes involved.

### Option 2: Feature Flag Kill Switch

Disable a problematic feature without redeploying.

```bash
# Via API (requires TENANT_ADMIN auth):
curl -X PUT /api/admin/feature-flags \
  -H "Content-Type: application/json" \
  -d '{"key": "intake_portal", "enabled": false}'

# Or directly in the database:
UPDATE feature_flags
SET enabled = false, "updatedAt" = NOW()
WHERE key = '<feature_key>' AND "tenantId" = '<tenant_id>';
```

**Available kill switches** (see `src/lib/feature-flags.ts`):

| Key | Module |
|---|---|
| `intake_portal` | Public intake portal |
| `delivery_portal` | Document delivery portal |
| `idv` | Identity verification |
| `response_generator` | Response document generation |
| `incidents_authorities` | Incident management |
| `vendors` | Vendor tracking |
| `executive_dashboard` | Executive KPI dashboard |
| `connectors_m365` | Microsoft 365 connector |
| `connectors_google` | Google Workspace connector |
| `advanced_redaction` | AI redaction |
| `copilot` | Privacy copilot |
| `ediscovery` | eDiscovery module |

**When to use**: New feature is problematic but rest of app is fine.

### Option 3: Database Migration Rollback

If a migration caused issues and must be reversed.

```bash
# 1. Check which migrations have been applied
npx prisma migrate status

# 2. If using Prisma Migrate, create a counter-migration
# (Prisma doesn't support auto-rollback; create reverse SQL manually)

# 3. For emergency rollback, restore from backup
pg_restore -d privacy_pilot backup_pre_deploy.dump
```

**When to use**: Schema change caused data issues. Use with caution.

## Rollback Decision Tree

```
Deployment fails health checks?
├── YES → Check /api/health/readiness for specific failure
│   ├── database: fail → Check DB connectivity, run migrations
│   ├── encryption: fail → Set PRIVACYPILOT_SECRET
│   └── All checks fail → Revert to previous version (Option 1)
│
├── Feature-specific bug?
│   ├── YES → Disable via feature flag (Option 2)
│   └── NO → Revert to previous version (Option 1)
│
└── Data corruption?
    ├── YES → Restore from backup (Option 3) + investigate
    └── NO → Revert code (Option 1)
```

## Post-Rollback Checklist

- [ ] Verify health probes return 200
- [ ] Verify error rate returns to normal (`/api/metrics`)
- [ ] Notify team of rollback and reason
- [ ] Create incident ticket for root cause analysis
- [ ] Document what went wrong for future prevention
