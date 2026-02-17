# Performance & Stability Guide — Sprint 9.3

This document covers the performance optimizations, caching strategy, job hardening,
and profiling tools introduced in Sprint 9.3.

## Table of Contents

1. [Common Bottlenecks](#common-bottlenecks)
2. [Database Indices](#database-indices)
3. [Caching Strategy](#caching-strategy)
4. [Job Runner Hardening](#job-runner-hardening)
5. [Pagination Enforcement](#pagination-enforcement)
6. [Query Profiling](#query-profiling)
7. [Verification Checklist](#verification-checklist)

---

## Common Bottlenecks

### Before Sprint 9.3

| Endpoint | Issue | Query Count | Fix |
|----------|-------|-------------|-----|
| `GET /api/executive/kpis` | Sequential queries (~20+) | 20-25 | Batched with `Promise.all`, cached 120s |
| `GET /api/cases/[id]` | Loads ALL relations in one query | 1 (but heavy) | Tab-based lazy loading via `?include=` |
| `GET /api/search` | Facets recalculated every request | 3+ | Facets cached 30s per tenant |
| `GET /api/cases` | `pageSize` up to 100, no max | 2 | Clamped to max 50 via pagination util |
| `POST /api/jobs/*` | No concurrency guard, no retry | Varies | JobRunner with locks + retry |

### N+1 Patterns Fixed

- **KPI Service**: Previously ran ~25 sequential `count()` calls. Now uses two
  `Promise.all` batches (2 round-trips instead of 25).
- **Case Detail**: Full relationship tree loaded always. Now only loads requested
  tabs via `?include=tasks,documents`.
- **Search Facets**: `groupBy` query ran on every search. Now cached 30s per tenant.

---

## Database Indices

### Migration: `20260217_performance_indices`

All indices are tenant-scoped composites on frequently filtered columns.

#### DSARCase (`dsar_cases`)
| Index | Columns | Purpose |
|-------|---------|---------|
| `dsar_cases_tenant_received_at` | `(tenantId, receivedAt DESC)` | Timeline views |
| `dsar_cases_tenant_due_date` | `(tenantId, dueDate)` | SLA filtering |
| `dsar_cases_tenant_priority` | `(tenantId, priority)` | Priority filters |
| `dsar_cases_tenant_type` | `(tenantId, type)` | Type filters |
| `dsar_cases_tenant_updated_at` | `(tenantId, updatedAt DESC)` | Recent activity |
| `dsar_cases_tenant_status_due` | `(tenantId, status, dueDate)` | Dashboard status+SLA |
| `dsar_cases_tenant_deleted_at` | `(tenantId, deletedAt)` | Soft-delete scans |

#### Task (`tasks`)
| Index | Columns | Purpose |
|-------|---------|---------|
| `tasks_tenant_status` | `(tenantId, status)` | Status filters |
| `tasks_tenant_due_date` | `(tenantId, dueDate)` | Due date views |
| `tasks_tenant_status_assignee` | `(tenantId, status, assigneeUserId)` | Workload views |

#### Document (`documents`)
| Index | Columns | Purpose |
|-------|---------|---------|
| `documents_tenant_case_deleted` | `(tenantId, caseId, deletedAt)` | Case docs (excl. deleted) |
| `documents_tenant_uploaded_at` | `(tenantId, uploadedAt DESC)` | Recent uploads |

#### SearchIndexEntry (`search_index_entries`)
| Index | Columns | Purpose |
|-------|---------|---------|
| `search_index_entries_fts_gin` | GIN on `fts_vector` | Full-text search |
| `search_index_entries_tenant_entity_updated` | `(tenantId, entityType, updatedAt DESC)` | Scoped search |

#### CaseDeadline (`case_deadlines`)
| Index | Columns | Purpose |
|-------|---------|---------|
| `case_deadlines_tenant_risk_due` | `(tenantId, currentRisk, effectiveDueAt)` | Risk dashboard |
| `case_deadlines_tenant_days_remaining` | `(tenantId, daysRemaining)` | "Due soon" views |

#### Other Tables
- `incidents`: `(tenantId, updatedAt DESC)`, `(tenantId, createdAt DESC)`
- `vendor_requests`: `(tenantId, dueAt)`, `(tenantId, updatedAt DESC)`
- `data_collection_items`: `(tenantId, status)`, `(tenantId, caseId, status)`
- `delivery_events`: `(tenantId, timestamp DESC)`
- `webhook_deliveries`: `(tenantId, status, nextRetryAt)`
- `job_runs`: `(tenantId, startedAt DESC)`, `(tenantId, jobName, status)`
- `audit_logs`: `(tenantId, createdAt DESC)`, `(tenantId, action)`

### Applying Indices

```bash
npm run db:migrate
# or for existing databases:
npx prisma db execute --file prisma/migrations/20260217_performance_indices/migration.sql
```

---

## Caching Strategy

### Architecture

- **Dev**: In-memory `Map` (per-process, process-scoped)
- **Prod**: Same in-memory cache (sufficient for single-process Next.js)
- **Future**: Redis adapter for multi-instance deployments

### Cache Keys

Keys are namespaced: `t:{tenantId}:{widget}:{sorted_filters}`

```ts
import { cache, cacheKey, CacheTTL } from "@/lib/cache-service";

const ck = cacheKey(tenantId, "kpi", { start: "2026-01", end: "2026-02" });
// → "t:abc123:kpi:end=2026-02&start=2026-01"
```

### TTL Values

| Widget | TTL | Rationale |
|--------|-----|-----------|
| `DASHBOARD_WIDGET` | 60s | Good enough for dashboard stats |
| `EXECUTIVE_KPI` | 120s | Heavy calculation, acceptable staleness |
| `SEARCH_FACETS` | 30s | Facet counts change slowly |
| `CASE_LIST` | 30s | Moderate freshness needed |
| `STATS` | 60s | Aggregate counts |

### Cache Invalidation

- **On case status change**: `invalidateWidgetCache(tenantId, "kpi")`
- **On case creation**: Invalidates KPI cache
- **TTL fallback**: All caches expire naturally, ensuring eventual consistency
- **Manual flush**: `invalidateTenantCache(tenantId)` clears all

### Monitoring

```
GET /api/diagnostics  (SUPER_ADMIN only)
```

Returns cache hit rate, size, and slow query log.

---

## Job Runner Hardening

### Features

| Feature | Description |
|---------|-------------|
| **Concurrency Guard** | In-memory lock prevents parallel runs of same job+tenant |
| **Idempotency Key** | Prevents duplicate processing within a time window |
| **Retry Policy** | Exponential backoff with configurable max retries |
| **Job Run Tracking** | Every run recorded in `job_runs` table with duration |

### Usage

```ts
import { runJob, RetryPolicies } from "@/lib/job-runner";

const result = await runJob(
  {
    jobName: "webhook_delivery",
    tenantId: user.tenantId,
    idempotencyKey: `webhook_${batchId}`,
    retry: RetryPolicies.WEBHOOK,
  },
  () => processPendingDeliveries(tenantId),
);
```

### Retry Policies

| Policy | Max Retries | Initial Delay | Max Delay |
|--------|-------------|---------------|-----------|
| `WEBHOOK` | 3 | 5s | 60s |
| `RETENTION` | 2 | 10s | 120s |
| `CONNECTOR` | 3 | 3s | 30s |
| `KPI_SNAPSHOT` | 1 | 5s | 5s |

### Hardened Endpoints

| Endpoint | Job Name | Idempotency |
|----------|----------|-------------|
| `POST /api/jobs/webhooks/deliver` | `webhook_delivery` | Per batch |
| `POST /api/jobs/retention` | `retention_deletion` | Daily |
| `POST /api/jobs/kpi/snapshot` | `kpi_snapshot` | Daily |
| `POST /api/jobs/connectors/run` | `connector_runs` | Per run |

---

## Pagination Enforcement

### Defaults

```ts
import { parsePagination, PAGE_SIZE_MAX } from "@/lib/pagination";
// PAGE_SIZE_DEFAULT = 20
// PAGE_SIZE_MAX = 50
```

All list endpoints now use `parsePagination()` which:
- Clamps `pageSize` to max 50
- Defaults to page 1, size 20
- Accepts both `pageSize` and `limit` params

### Case Detail Tab Loading

The `GET /api/cases/[id]` endpoint now supports selective includes:

```
GET /api/cases/123                      → core data + transitions only
GET /api/cases/123?include=tasks        → + tasks (max 50)
GET /api/cases/123?include=documents    → + documents (max 50)
GET /api/cases/123?include=all          → legacy: load everything
GET /api/cases/123?include=tasks,legal  → multiple tabs
```

Available includes: `overview`, `tasks`, `documents`, `comments`,
`communications`, `data-collection`, `legal`, `all`.

---

## Query Profiling

### Dev-Only Headers

When `NODE_ENV=development` or `ENABLE_QUERY_PROFILING=true`:

| Header | Description |
|--------|-------------|
| `X-Query-Count` | Number of database queries in request |
| `X-Query-Duration-Ms` | Total query execution time |
| `X-Request-Duration-Ms` | Total request processing time |

### Slow Query Log

Requests exceeding 200ms or 10 queries are logged to an in-memory buffer.
View via `GET /api/diagnostics`.

### Usage in Routes

```ts
import { createRequestProfiler, recordEndpointDiagnostics } from "@/lib/query-profiler";

export async function GET(request: NextRequest) {
  const profiler = createRequestProfiler();
  // ... queries ...
  recordEndpointDiagnostics("/api/my-endpoint", profiler);
  return NextResponse.json(data, { headers: profiler.getHeaders() });
}
```

---

## Verification Checklist

### After Deployment

- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Verify indices: `SELECT indexname FROM pg_indexes WHERE tablename = 'dsar_cases';`
- [ ] Hit executive KPI endpoint — should see `X-Query-Count` header in dev
- [ ] Hit KPI endpoint twice — second call should be faster (cached)
- [ ] Try `GET /api/cases/[id]?include=overview` — should be lighter than `?include=all`
- [ ] Try `GET /api/search?pageSize=100` — should be clamped to 50
- [ ] Run `POST /api/jobs/kpi/snapshot` twice in quick succession — second should skip (idempotency)
- [ ] Run `POST /api/jobs/webhooks/deliver` while another is running — should get concurrency error
- [ ] Check `GET /api/diagnostics` for cache stats and slow query log

### Performance Expectations

| Endpoint | Before | After (Expected) |
|----------|--------|-------------------|
| `GET /api/executive/kpis` | ~500-800ms | ~100-200ms (cached: <5ms) |
| `GET /api/cases/[id]` (overview) | ~200-400ms | ~50-100ms |
| `GET /api/search` (with FTS) | ~300-600ms | ~100-300ms (facets cached) |

### Running Tests

```bash
npm test -- tests/unit/perf-hardening.test.ts
```
