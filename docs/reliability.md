# Reliability Guide — PrivacyPilot Dashboard

## How to Debug the Incident Widget

### Symptom
The "Incident-Linked DSARs" widget on the dashboard shows **"Failed to load incident data"**.

### Root Cause Analysis

The widget fetches from `GET /api/incidents/stats`. Common failure modes:

| Cause | HTTP Status | User Sees | Fix |
|-------|-------------|-----------|-----|
| User lacks `INCIDENT_VIEW` permission | 200 + `permissionDenied: true` | "No access" card (grey) | Assign appropriate role (CASE_MANAGER+) |
| User not authenticated | 401 | "Please log in" card | Re-authenticate |
| Database timeout | 504 | Error card + Retry button | Check DB connection pool, query performance |
| Prisma connection failure | 500 | Error card + Retry button | Check `DATABASE_URL`, run health check |
| Network error (client) | 0 | Error card + Retry button | Check browser network, API availability |

### Debugging Steps

1. **Check permissions first**:
   ```
   # Verify user role has INCIDENT_VIEW
   # Roles with INCIDENT_VIEW: SUPER_ADMIN, TENANT_ADMIN, DPO, CASE_MANAGER, ANALYST, AUDITOR
   # Roles WITHOUT: CONTRIBUTOR, READ_ONLY
   ```

2. **Check structured logs** for the correlation ID:
   ```bash
   # Server logs are JSON lines. Filter by route:
   grep '"route":"GET /api/incidents/stats"' logs | jq .

   # Find a specific request by correlation ID:
   grep '"correlation_id":"<id>"' logs | jq .
   ```

3. **Run the diagnostics endpoint** (admin only):
   ```bash
   curl -H "Cookie: <session>" http://localhost:3000/api/diag/dashboard | jq .
   ```
   This returns per-widget status, latency, and row counts.

4. **Run the health check**:
   ```bash
   curl http://localhost:3000/api/health | jq .
   ```
   Returns `{ "status": "healthy" | "degraded", "checks": { "database": {...} } }`.

5. **Test the endpoint directly**:
   ```bash
   curl -H "Cookie: <session>" http://localhost:3000/api/incidents/stats | jq .
   ```
   Expected: `{ "openIncidents": N, "contained": N, ... }` or `{ "permissionDenied": true, "message": "..." }`.

---

## Reliability Architecture

### Error Handling Strategy

#### Server Side (`src/lib/errors.ts`)
- All API errors return a structured JSON body: `{ error, code, correlation_id, details? }`
- `handleApiError(error, ctx?)` handles: `ApiError`, `ZodError`, `QueryTimeoutError`, and unhandled errors
- Correlation IDs are generated per request via `withRequestContext()` and included in all error responses
- The `x-correlation-id` response header is set on success responses for tracing

#### Client Side (`src/lib/fetch-client.ts`)
- `fetchJsonWithRetry<T>(url, options)` wraps `fetch()` with:
  - Automatic retry (default 2 attempts) with exponential backoff
  - Only retries on transient failures: 408, 429, 502, 503, 504, network errors
  - Never retries 401/403 (permission issues)
  - Returns a structured `FetchResult<T>` — never throws

### Dashboard Widget Resilience

#### Error Boundaries (`src/components/DashboardWidgetErrorBoundary.tsx`)
- Every widget on the dashboard is wrapped in an error boundary
- If a widget crashes during render, the boundary catches it and shows a fallback card
- Users can click "Retry" to remount the widget
- Other widgets continue to function normally

#### Graceful Degradation Pattern
Widgets follow a 4-state model:
1. **Loading** — skeleton animation
2. **Loaded** — data displayed
3. **No Permission** — grey informational card (not an error)
4. **Error** — red card with retry button for transient errors

### Structured Logging (`src/lib/request-context.ts`)

All API routes emit JSON log lines with:
```json
{
  "timestamp": "2026-02-16T12:00:00.000Z",
  "level": "info|warn|error",
  "correlation_id": "uuid",
  "tenant_id": "tenant-uuid",
  "route": "GET /api/incidents/stats",
  "action": "incident_stats_ok",
  "duration_ms": 45,
  "status": 200
}
```

**PII Protection**: Email addresses in log values are automatically masked (`j***@example.com`).

### Timeboxed Queries

Long-running Prisma queries are wrapped with `timeboxedQuery(fn, timeoutMs, ctx)`:
- If the query exceeds the timeout, a `QueryTimeoutError` is thrown
- The API returns HTTP 504 with `{ code: "QUERY_TIMEOUT" }`
- Default timeout for incident stats: 10 seconds

---

## Health & Diagnostics Endpoints

### `GET /api/health`
- **Auth**: None (suitable for load balancers)
- **Returns**: `{ status: "healthy"|"degraded", checks: { database: { status, latency_ms } } }`
- **HTTP Status**: 200 if all checks pass, 503 if any fail

### `GET /api/diag/dashboard`
- **Auth**: Requires `EXEC_DASHBOARD_FULL` permission (TENANT_ADMIN / SUPER_ADMIN)
- **Returns**: Per-widget query status, latency, and row counts
- **Use case**: Admin debugging of dashboard load issues

---

## Reliability Checklist

### Before Deploying

- [ ] All unit tests pass: `npm test`
- [ ] Health check returns 200: `curl /api/health`
- [ ] Dashboard loads without errors for admin user
- [ ] Dashboard shows "No access" (not error) for READ_ONLY user
- [ ] Structured logs are being emitted (check console)

### When Investigating Dashboard Failures

- [ ] Check `/api/health` — is the database reachable?
- [ ] Check `/api/diag/dashboard` — which widget is failing?
- [ ] Check server logs for the correlation ID from the error response
- [ ] Check user's role — do they have `INCIDENT_VIEW`?
- [ ] Check Prisma query performance (look for `query_timeout` in logs)
- [ ] Check for N+1 queries (look for high `duration_ms` values)

### Adding New Dashboard Widgets

- [ ] Wrap with `<DashboardWidgetErrorBoundary widgetName="...">`
- [ ] Use `fetchJsonWithRetry()` for data fetching
- [ ] Handle all 4 states: loading, loaded, no_permission, error
- [ ] Use soft permission checks (return empty data, not 403) for dashboard widgets
- [ ] Add the widget to `/api/diag/dashboard` checks
- [ ] Add timeout protection with `timeboxedQuery()`
- [ ] Emit structured logs with `structuredLog()`

---

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/request-context.ts` | Correlation IDs, structured logging, safe JSON, timeboxed queries |
| `src/lib/errors.ts` | ApiError class, handleApiError with correlation ID support |
| `src/lib/fetch-client.ts` | Client-side fetch with retry & backoff |
| `src/components/DashboardWidgetErrorBoundary.tsx` | React error boundary for widgets |
| `src/components/IncidentDashboardWidget.tsx` | Incident stats widget with graceful degradation |
| `src/app/api/incidents/stats/route.ts` | Incident stats API with soft permission check |
| `src/app/api/health/route.ts` | Health check endpoint |
| `src/app/api/diag/dashboard/route.ts` | Dashboard diagnostics (admin only) |
| `tests/unit/reliability.test.ts` | Reliability baseline tests (33 tests) |
