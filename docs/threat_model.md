# PrivacyPilot Threat Model

> Sprint 9.2 — Security Hardening

## Assets

| Asset | Sensitivity | Description |
|-------|-------------|-------------|
| DSAR Case Data | HIGH | Subject PII, request details, legal basis |
| Identity Documents (IDV) | CRITICAL | Passports, IDs, selfies |
| Response Documents | HIGH | Generated response PDFs with PII |
| Audit Logs | MEDIUM | Access records, actor actions |
| API Keys | HIGH | Bearer tokens for public API |
| Delivery Tokens | HIGH | Time-limited access to case packages |
| IDV Portal Tokens | HIGH | Signed tokens for identity verification |
| User Credentials | CRITICAL | Hashed passwords, session JWTs |
| Tenant Configuration | MEDIUM | Governance settings, SLA config |
| Vendor/Processor Data | MEDIUM | DPA status, contact info |
| Integration Secrets | CRITICAL | AWS/M365 credentials, connector configs |

## Threat Actors

| Actor | Capability | Motivation |
|-------|-----------|------------|
| External Attacker | Network access, automated tooling | Data theft, ransom, disruption |
| Malicious Insider | Valid credentials, known workflows | Data exfiltration, sabotage |
| Curious Employee | Valid credentials, limited role | PII snooping, unauthorized access |
| Competitor Tenant | Valid credentials in different tenant | Cross-tenant data access |
| Data Subject | Public portal access, token possession | Abuse/DoS of intake/delivery |
| Automated Bot | HTTP access, scripting | Spam intake, token brute-force |

## Threats and Mitigations

### T1: Cross-Tenant Data Leakage
**Impact**: CRITICAL — One tenant's DSAR data exposed to another tenant
**Attack Vector**: Missing `tenantId` in database queries, IDOR in API routes
**Mitigations**:
- Every query includes `tenantId` filter (185+ occurrences verified)
- `tenantWhere()` and `assertTenantScoped()` guards enforce isolation
- Entity lookup uses `findFirst({ id, tenantId })` instead of `findUnique({ id })`
- Cross-tenant access returns 404 (not 403) — prevents enumeration
- Security regression tests verify tenant isolation

### T2: Privilege Escalation
**Impact**: HIGH — Lower-privilege user performs admin actions
**Attack Vector**: Missing RBAC checks, client-side-only authorization
**Mitigations**:
- 169 fine-grained permissions enforced server-side via `enforce()`
- Policy Engine provides deny-by-default centralized checks
- `canReadCase()`, `canWriteCase()` check team membership for non-admin roles
- UI controls are cosmetic — backend is authoritative
- RBAC regression tests verify each role's boundaries

### T3: IDOR (Insecure Direct Object Reference)
**Impact**: HIGH — Access to artifacts/cases by guessing IDs
**Attack Vector**: Enumerate UUIDs to access other users' documents
**Mitigations**:
- Unified artifact download resolves: artifact → case → tenant chain
- `canDownloadArtifact()` verifies full ownership chain
- Access denied returns 404 (not 403) — prevents confirmation of existence
- Audit + access logging on every download attempt (allowed and denied)

### T4: Token Theft/Brute-Force (IDV Portal)
**Impact**: HIGH — Unauthorized access to identity verification portal
**Attack Vector**: Guess or intercept IDV portal token
**Mitigations**:
- Tokens are HMAC-SHA256 signed with NEXTAUTH_SECRET
- Token includes expiration timestamp (7 days default)
- Invalid/expired tokens return 404 (no info leakage)
- Rate limited: 30 req/min per IP
- Submission count limit per token (default 3)

### T5: Token Theft/Brute-Force (Delivery Portal)
**Impact**: HIGH — Unauthorized access to response documents
**Attack Vector**: Guess delivery token, brute-force OTP
**Mitigations**:
- Token: salted SHA-256 hash (32 bytes random, cryptographically secure)
- OTP: 6-digit, expiring (15 min default)
- OTP lockout: 5 failed attempts → 30 min lockout
- Download count limits per link
- Link expiration (7 days default)
- OTP never returned in response (dev-mode disclosure removed)
- Rate limited: OTP send (3/15min), OTP verify (5/15min + lockout)

### T6: Intake Portal Abuse (Spam/DoS)
**Impact**: MEDIUM — Flooded intake queue, operational disruption
**Attack Vector**: Automated form submissions, large file uploads
**Mitigations**:
- Rate limited: 5 submissions per minute per IP+tenant
- Honeypot field (silently accepts but discards spam)
- File validation: allowed MIME types, max 10MB/file, max 5 files
- Consent checkbox required
- Deduplication engine catches repeat submissions

### T7: API Key Compromise
**Impact**: HIGH — Automated access to case data via stolen key
**Attack Vector**: Key leaked in logs, code, or config
**Mitigations**:
- Keys stored as SHA-256 hashes only
- Full key shown once at creation, never retrievable
- Scoped access (least privilege per key)
- Rate limited: 120 req/min per key
- Revocation support (immediate effect)
- Audit logging of all API calls with key identifier

### T8: Session Hijacking
**Impact**: HIGH — Attacker impersonates authenticated user
**Attack Vector**: XSS to steal session cookie, network interception
**Mitigations**:
- JWT-based sessions with 8-hour expiry
- HTTP-only cookies (managed by NextAuth)
- All API calls require valid session
- Session includes tenantId — cannot be modified client-side

### T9: SQL Injection
**Impact**: CRITICAL — Database manipulation/exfiltration
**Attack Vector**: Crafted input bypasses parameterization
**Mitigations**:
- Prisma ORM: all queries parameterized by default
- No raw SQL queries in application code (health check uses safe `$queryRaw`)
- Input validation via Zod schemas at every API boundary

### T10: Information Leakage
**Impact**: MEDIUM — Internal details exposed in error responses
**Attack Vector**: Verbose error messages, stack traces, 403 vs 404 distinction
**Mitigations**:
- Structured error responses: `{ error, code, correlation_id }`
- Resource-scoped denials return 404 (not 403)
- Stack traces only in development mode
- Storage keys/paths never exposed to client
- PII masked in structured logs

### T11: Integration Secret Leakage
**Impact**: CRITICAL — Cloud infrastructure credentials exposed
**Attack Vector**: Secrets stored in plaintext, logged, or exposed via API
**Mitigations**:
- Secrets encrypted with `INTEGRATION_ENCRYPTION_KEY` (AES-256-GCM)
- Encryption key stored in environment variable only
- Secrets never included in API responses
- Audit logged when accessed or modified

## Risk Matrix

| Threat | Likelihood | Impact | Risk | Status |
|--------|-----------|--------|------|--------|
| T1: Cross-Tenant Leakage | Low | Critical | HIGH | Mitigated |
| T2: Privilege Escalation | Low | High | MEDIUM | Mitigated |
| T3: IDOR | Medium | High | HIGH | Mitigated (Sprint 9.2) |
| T4: IDV Token Abuse | Medium | High | HIGH | Mitigated (Sprint 9.2) |
| T5: Delivery Token Abuse | Medium | High | HIGH | Mitigated (Sprint 9.2) |
| T6: Intake Spam/DoS | High | Medium | MEDIUM | Mitigated (Sprint 9.2) |
| T7: API Key Compromise | Low | High | MEDIUM | Mitigated |
| T8: Session Hijacking | Low | High | MEDIUM | Mitigated |
| T9: SQL Injection | Very Low | Critical | LOW | Mitigated (Prisma ORM) |
| T10: Info Leakage | Medium | Medium | MEDIUM | Mitigated (Sprint 9.2) |
| T11: Secret Leakage | Low | Critical | MEDIUM | Mitigated |

## Residual Risks

1. **In-memory rate limiting** does not work across multiple instances. For production horizontal scaling, replace with Redis-backed rate limiter.
2. **No malware scanning** on uploaded files. Consider ClamAV integration for production.
3. **S3 storage stub** — local storage fallback in dev. Must implement real S3 for production.
4. **Health endpoint** (`/api/health`) returns DB connectivity status without auth. Consider restricting to internal IPs.
