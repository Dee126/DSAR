# Incident Playbook

## Severity Levels

| Level | Definition | Response Time | Examples |
|---|---|---|---|
| P1 | Data breach / full outage | Immediate | Cross-tenant data leak, DB down, auth bypass |
| P2 | Major feature broken | < 1 hour | Case creation fails, export broken, status transitions stuck |
| P3 | Minor feature degraded | < 4 hours | Slow queries, intermittent errors, UI glitch |
| P4 | Cosmetic / low-impact | Next sprint | Typo, minor styling issue |

## Incident Response Flow

```
1. DETECT → Health probes, user report, error spike in /api/metrics
2. TRIAGE → Determine severity (P1–P4)
3. CONTAIN → Feature flag kill switch, rollback if needed
4. INVESTIGATE → Logs, audit trail, DB state
5. RESOLVE → Fix, test, deploy
6. POST-MORTEM → Document, improve
```

---

## Playbook: Cross-Tenant Data Leakage

**Severity**: P1 — Immediate response required

### Detection
- User reports seeing another tenant's data
- Audit log shows access to resources outside user's tenant

### Containment
1. **Immediately** identify affected API route
2. Disable the route or take the app offline if scope is unknown
3. Preserve audit logs — do NOT delete or modify

### Investigation
```sql
-- Check for cross-tenant access in audit logs
SELECT * FROM "audit_logs"
WHERE "tenantId" != (
  SELECT "tenantId" FROM "users" WHERE id = "actorUserId"
)
ORDER BY "createdAt" DESC
LIMIT 100;

-- Check if any query is missing tenantId filter
-- Review the API route code for missing `where: { tenantId }` clauses
```

### Resolution
1. Fix the missing `tenantId` filter in the affected query
2. Add regression test
3. Deploy fix
4. Notify affected tenants per GDPR Article 33/34 requirements

### Prevention
- All Prisma queries MUST include `tenantId` in `where` clause
- Code review checklist: "Is tenantId enforced?"
- Consider row-level security at DB level

---

## Playbook: Token / Session Abuse

**Severity**: P1

### Detection
- Multiple sessions from unusual IPs
- Audit logs show actions from expired/invalid tokens
- User reports unauthorized actions

### Containment
1. Invalidate the affected user's sessions
2. Force password reset for affected accounts

### Investigation
```sql
-- Check user's recent audit trail
SELECT action, ip, "userAgent", "createdAt"
FROM "audit_logs"
WHERE "actorUserId" = '<user_id>'
ORDER BY "createdAt" DESC
LIMIT 50;
```

### Resolution
1. Rotate `NEXTAUTH_SECRET` (invalidates all sessions)
2. Review auth-options.ts for session handling issues
3. Check if session expiry (8h) is being enforced

---

## Playbook: Webhook Delivery Failures

**Severity**: P3

### Detection
- Webhook endpoint returns non-2xx repeatedly
- Metrics show increasing error rate on webhook routes

### Investigation
```sql
-- Check webhook endpoint status
SELECT id, url, enabled, "lastDeliveryAt", "failureCount"
FROM "webhook_endpoints"
WHERE "tenantId" = '<tenant_id>';

-- Check recent webhook delivery logs
SELECT * FROM "webhook_deliveries"
WHERE "endpointId" = '<endpoint_id>'
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Resolution
1. Verify target URL is reachable
2. Check if webhook secret is still valid
3. Disable endpoint if consistently failing (auto-disable after N failures)
4. Notify tenant admin

---

## Playbook: Export Failures

**Severity**: P2–P3

### Detection
- User reports export download fails
- Metrics show errors on `/api/cases/[id]/export/*` routes

### Investigation
1. Check storage backend:
   ```bash
   # Local storage
   ls -la ./uploads/

   # S3
   aws s3 ls s3://$S3_BUCKET/ --region $S3_REGION
   ```
2. Check for large case data (timeouts on large exports)
3. Review error in application logs

### Resolution
1. If storage is full: clean up old temp files, increase storage
2. If timeout: increase export timeout, paginate data collection
3. If permissions: fix S3 IAM policy or local file permissions

---

## Playbook: Database Performance Degradation

**Severity**: P2–P3

### Detection
- Readiness probe shows high DB latency
- Metrics show increasing avg_latency_ms
- Users report slow page loads

### Investigation
```sql
-- Check active queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';

-- Check table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- Check missing indexes
SELECT relname, seq_scan, idx_scan, n_tup_ins, n_tup_upd
FROM pg_stat_user_tables
WHERE seq_scan > 1000
ORDER BY seq_scan DESC;
```

### Resolution
1. Kill long-running queries if they're blocking
2. Add missing indexes (see `prisma/schema.prisma` for `@@index` declarations)
3. Enable query profiling: `ENABLE_QUERY_PROFILING=true`
4. Review query profiler output at `/api/diagnostics/query-profiler`
5. Consider connection pool tuning

---

## General: Useful Diagnostic Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health/liveness` | Is the process alive? |
| `GET /api/health/readiness` | Are all dependencies ready? |
| `GET /api/metrics` | Request counts, error rates, latency |
| `GET /api/admin/feature-flags` | Current feature flag states |
| `GET /api/audit-logs` | Recent audit trail |

## General: Useful SQL Queries

```sql
-- Recent errors in audit log
SELECT * FROM "audit_logs"
WHERE action LIKE '%ERROR%' OR action LIKE '%FAIL%'
ORDER BY "createdAt" DESC LIMIT 20;

-- Cases stuck in a state for too long
SELECT id, status, "createdAt", "updatedAt",
       NOW() - "updatedAt" AS time_in_state
FROM "dsar_cases"
WHERE status NOT IN ('CLOSED', 'REJECTED')
ORDER BY "updatedAt" ASC
LIMIT 20;

-- Feature flag audit trail
SELECT * FROM "feature_flag_audits"
ORDER BY "createdAt" DESC LIMIT 20;
```
