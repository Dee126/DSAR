# PrivacyPilot Security Model

> Sprint 9.2 — Security Hardening

## Authentication

### Session-Based (Internal UI + API)
- **Provider**: NextAuth.js with CredentialsProvider
- **Strategy**: JWT (stateless)
- **Session Duration**: 8 hours
- **Password Hashing**: bcryptjs, 12 rounds
- **Token Storage**: HTTP-only cookies (managed by NextAuth)
- **Route Protection**: Next.js middleware blocks unauthenticated access to `/dashboard/*`, `/cases/*`, etc.

### API Key (Public API v1)
- **Format**: `pp_live_<32 random chars>`
- **Storage**: SHA-256 hash only (key never stored in plaintext)
- **Scopes**: `cases:read`, `cases:write`, `systems:read`, `vendors:write`, `webhooks:write`, `connectors:run`, `documents:read`, `incidents:read`, `admin:all`
- **Rate Limiting**: 120 req/min per key

### Token-Based (Public Portals)
- **IDV Portal**: HMAC-SHA256 signed token with `requestId`, `tenantId`, `expiresAt`
- **Delivery Portal**: Salted SHA-256 hashed token with per-link salt

## RBAC (Role-Based Access Control)

### Roles (highest → lowest)
| Role | Scope |
|------|-------|
| SUPER_ADMIN | All permissions, all tenants |
| TENANT_ADMIN | All permissions within tenant |
| DPO | Governance, approvals, full case lifecycle |
| CASE_MANAGER | Case CRUD, team management, vendor requests |
| ANALYST | Read + update assigned cases only |
| AUDITOR | Read-only + audit log access |
| CONTRIBUTOR | Limited read + comment + upload |
| READ_ONLY | Read access only |

### Permission System
- **169 fine-grained permissions** across 22 domains
- **Deny-by-default**: `has(role, permission)` returns `false` for unknown roles
- **Server-side enforcement**: Every API route MUST call `enforce()` or `checkPermission()`
- **UI controls are cosmetic only** — backend is the single source of truth

### Policy Engine (Sprint 9.2)
Central policy evaluation at `src/lib/security/policy-engine.ts`:
- `canPerform(actor, permission)` — RBAC check
- `canReadCase(actor, caseId)` — Case-level access with team membership
- `canWriteCase(actor, caseId)` — Write access with read-only enforcement
- `canDownloadArtifact(actor, artifactId, type)` — IDOR-safe artifact access
- All functions return `PolicyDecision { allowed, reason, code }`
- `enforcePolicy(decision)` throws 404 (not 403) for resource-scoped denials

## Tenant Isolation

### Enforcement
- **Every database table** includes `tenantId`
- **Every query** MUST include `tenantId` filter
- Utility: `tenantWhere(tenantId, filters)` — always includes tenantId
- Utility: `assertTenantScoped(entity, tenantId)` — validates entity ownership
- Cross-tenant access returns **404** (not 403) to prevent tenant enumeration

### Guards (Sprint 9.2)
Located at `src/lib/security/tenant-guard.ts`:
- `assertTenantScoped(entity, tenantId)` — throws 404 if mismatch
- `tenantWhere(tenantId, filters)` — safe WHERE clause builder
- `tenantEntityWhere(tenantId, id)` — safe findFirst alternative to findUnique
- `getTenantIdFromSession(user)` — extracts and validates tenantId

## Rate Limiting

### Implementation
Located at `src/lib/security/rate-limiter.ts`. In-memory, configurable per-bucket.

### Presets
| Bucket | Limit | Window | Lockout |
|--------|-------|--------|---------|
| INTAKE_SUBMIT | 5 req | 1 min | — |
| OTP_SEND | 3 req | 15 min | — |
| OTP_VERIFY | 5 req | 15 min | 30 min |
| IDV_SUBMIT | 3 req | 1 hour | — |
| API_KEY | 120 req | 1 min | — |
| LOGIN | 10 req | 15 min | 30 min |
| PUBLIC_GENERAL | 30 req | 1 min | — |

## File/Artifact Security

### Unified Download Endpoint (Sprint 9.2)
`GET /api/artifacts/:id/download?type=DOCUMENT|IDV_ARTIFACT|RESPONSE_DOC`

Security chain:
1. Authentication (requireAuth)
2. RBAC permission (DOCUMENT_DOWNLOAD)
3. Policy engine: artifact → case → tenant chain resolution
4. Tenant isolation verification
5. Deletion check
6. Audit logging (audit_log + access_logs)
7. File streamed via backend — no direct storage URLs exposed

### IDOR Prevention
- Artifact ID alone is never sufficient — always resolved through ownership chain
- `canDownloadArtifact()` checks: permission + tenant + case access + deletion status
- Storage keys (S3/local paths) never exposed to client

## Audit Logging

### What Is Logged
- All CRUD operations on cases, documents, tasks, comments
- All state transitions with reason
- All file uploads, downloads, views
- All user management changes
- All API key operations
- All login/logout events
- Both allowed AND denied access attempts

### Access Logs (Module 8.4)
Separate `access_logs` table tracking sensitive resource access:
- Resource type, ID, case ID
- Actor, IP (hashed), User Agent (hashed)
- Outcome: ALLOWED or DENIED
- Written for every download/view/export

### PII Protection
- Structured logs mask email addresses
- IP addresses hashed in access logs
- User agents hashed in access logs
- No raw PII in audit log details

## Public Portal Security

### Intake Portal
- Rate limited: 5 submissions per minute per IP+tenant
- Honeypot field for bot detection (silently accepts but discards)
- File validation: allowed MIME types, max 10MB per file, max 5 files
- No authentication required — tenant resolved via slug

### IDV Portal
- Token-based access (HMAC-SHA256 signed, time-limited)
- Invalid/expired token → 404 (no information leakage)
- Rate limited per IP
- Submission count limit per token
- File type restricted to images and PDFs

### Delivery Portal
- Salted hashed token (SHA-256)
- OTP verification (6-digit, expiring, lockout after 5 failed attempts)
- Invalid token → 404
- Rate limited: OTP send (3/15min), OTP verify (5/15min + lockout)
- Download count limits per link
- Link expiration enforcement
- Storage keys never exposed to client
- OTP never returned in API response (dev-mode disclosure removed)

## Session Security
- JWT-based with 8-hour expiry
- Session includes: userId, tenantId, role
- Middleware protects all dashboard routes
- API routes enforce auth independently via `requireAuth()`

## Input Validation
- All API inputs validated with Zod schemas
- ZodError caught by `handleApiError()` → 400 with validation details
- Type-safe: TypeScript strict mode enforced
- SQL injection mitigated by Prisma ORM parameterization
