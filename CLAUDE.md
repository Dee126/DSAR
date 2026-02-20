# CLAUDE.md

This file provides guidance for AI assistants working on the PrivacyPilot (DSAR Copilot) repository.

## Repository Overview

**Project**: PrivacyPilot — DSAR (Data Subject Access Request) Management Platform
**Repository**: Dee126/DSAR
**Stack**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL + NextAuth.js

A multi-tenant, role-based platform for organizations to manage GDPR Data Subject Access Requests. Features case lifecycle management with a strict state machine, task tracking, document management, and comprehensive audit logging.

## Project Structure

```
DSAR/
├── prisma/
│   ├── schema.prisma              # Data model (10 models, 6 enums)
│   └── seed.ts                    # Demo data seeder
├── src/
│   ├── app/
│   │   ├── (dashboard)/           # Authenticated pages (route group)
│   │   │   ├── layout.tsx         # Dashboard shell (sidebar + main)
│   │   │   ├── dashboard/page.tsx # Overview stats
│   │   │   ├── cases/             # Case list, create, detail
│   │   │   ├── tasks/page.tsx     # Cross-case tasks
│   │   │   ├── documents/page.tsx # Cross-case documents
│   │   │   └── settings/page.tsx  # Tenant config, users, systems
│   │   ├── api/                   # REST API routes
│   │   │   ├── auth/              # NextAuth handler
│   │   │   ├── cases/             # CRUD, transitions, tasks, docs, comments, export
│   │   │   ├── tasks/[id]/        # Task updates
│   │   │   ├── documents/[id]/    # Download
│   │   │   ├── users/             # User management
│   │   │   ├── data-subjects/     # Subject search
│   │   │   ├── systems/           # Processor map
│   │   │   └── audit-logs/        # Audit viewer
│   │   ├── login/page.tsx         # Login page
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Redirects to /dashboard
│   │   └── globals.css            # Tailwind + custom classes
│   ├── components/
│   │   ├── Providers.tsx          # SessionProvider wrapper
│   │   └── Sidebar.tsx            # Left navigation
│   ├── lib/
│   │   ├── auth.ts                # Session helpers (requireAuth, requireRole)
│   │   ├── auth-options.ts        # NextAuth config (credentials provider)
│   │   ├── rbac.ts                # Role-based access control matrix
│   │   ├── state-machine.ts       # DSAR status transition rules
│   │   ├── audit.ts               # Audit log writer
│   │   ├── storage.ts             # File storage (local/S3 abstraction)
│   │   ├── validation.ts          # Zod schemas for all API inputs
│   │   ├── errors.ts              # ApiError + handleApiError
│   │   ├── prisma.ts              # Prisma client singleton
│   │   └── utils.ts               # Case number generation, SLA helpers
│   ├── middleware.ts              # NextAuth route protection
│   └── types/next-auth.d.ts      # Session type augmentation
├── tests/
│   ├── unit/state-machine.test.ts # State transition tests (vitest)
│   └── e2e/dsar-workflow.spec.ts  # Full workflow E2E (playwright)
├── docker-compose.yml             # PostgreSQL for dev
├── .env.example                   # Environment template
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm test                 # Unit tests (vitest)
npm run test:e2e         # E2E tests (playwright)
npm run db:generate      # Regenerate Prisma client
npm run db:migrate       # Run migrations
npm run db:push          # Push schema to DB (no migration)
npm run db:seed          # Seed demo data
npm run docker:up        # Start PostgreSQL
npm run docker:down      # Stop PostgreSQL
```

## Key Patterns

### Multi-Tenancy
Every database table includes `tenantId`. All API queries MUST filter by `tenantId` derived from `session.user.tenantId`. Never expose cross-tenant data.

### API Route Pattern
```ts
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { handleApiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();                    // 401 if no session
    checkPermission(user.role, "cases", "read");         // 403 if no access
    const data = await prisma.dSARCase.findMany({
      where: { tenantId: user.tenantId },                // Tenant isolation
    });
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);                        // Consistent error shape
  }
}
```

### RBAC Roles (highest → lowest)
SUPER_ADMIN → TENANT_ADMIN → DPO → CASE_MANAGER → CONTRIBUTOR → READ_ONLY

Permission matrix defined in `src/lib/rbac.ts`. Always use `checkPermission()` server-side.

### State Machine
Defined in `src/lib/state-machine.ts`. Allowed transitions:
- NEW → IDENTITY_VERIFICATION | INTAKE_TRIAGE | REJECTED
- IDENTITY_VERIFICATION → INTAKE_TRIAGE | REJECTED
- INTAKE_TRIAGE → DATA_COLLECTION | REJECTED
- DATA_COLLECTION → REVIEW_LEGAL
- REVIEW_LEGAL → RESPONSE_PREPARATION | DATA_COLLECTION (send-back)
- RESPONSE_PREPARATION → RESPONSE_SENT
- RESPONSE_SENT → CLOSED
- REJECTED → CLOSED
- CLOSED → (terminal)

Every transition requires a reason and is logged to `DSARStateTransition` + `AuditLog`.

### Audit Logging
Use `logAudit()` from `src/lib/audit.ts` for: login/logout, case CRUD, status transitions, document upload/download/view, exports, user management changes.

### Validation
All API inputs validated with Zod schemas from `src/lib/validation.ts`. Use `.parse()` which throws `ZodError` — caught by `handleApiError()`.

### Storage
File storage via `src/lib/storage.ts`. Uses `STORAGE_TYPE` env var:
- `local`: files saved to `STORAGE_LOCAL_PATH` (default `./uploads`)
- `s3`: S3-compatible (stubbed, falls back to local in dev)

## Privacy and Security

- Never hardcode credentials, API keys, or secrets
- Never commit `.env` files or files containing personal data
- All personal data access must be audit-logged
- Input validation at every API boundary (Zod)
- Tenant isolation enforced on every query
- Role-based access enforced server-side (not just UI)
- Sessions expire after 8 hours (JWT strategy)
- Passwords hashed with bcryptjs (12 rounds)

## Testing

- **Unit tests**: `tests/unit/` — run with `npm test` (vitest)
- **E2E tests**: `tests/e2e/` — run with `npm run test:e2e` (playwright)
- When modifying state machine logic, update state-machine.test.ts
- When modifying API routes, consider adding corresponding tests
- Seed data (admin@acme-corp.com / admin123456) is used by E2E tests

## Deployment & Migrations

### Vercel Build
The default `build` script is `prisma generate && next build`. It does **not** touch the database.
Vercel only needs `DATABASE_URL` (pooled, port 6543) and `NEXTAUTH_SECRET` as env vars.

### Database Migrations
Run migrations **locally or in CI**, never during the Vercel build:
```bash
# Set DIRECT_URL to the non-pooled Supabase connection (port 5432)
export DIRECT_URL="postgresql://postgres.REF:PASSWORD@db.REF.supabase.co:5432/postgres"
export DATABASE_URL="$DIRECT_URL"   # prisma migrate needs a non-pooled URL

npx prisma migrate deploy           # apply pending migrations
# OR
npx prisma db push                  # push schema without migration files
```

To seed the default tenant/admin users:
```bash
node prisma/deploy.js               # needs DATABASE_URL set
# OR
npm run build:with-db                # generate + deploy.js + next build (for CI)
```

### Environment Variables

See `.env.example` for all variables. Key ones:
- `DATABASE_URL` — PostgreSQL connection string (pooled, port 6543 for Vercel)
- `DIRECT_URL` — Non-pooled connection (port 5432) — **local/CI only, not needed on Vercel**
- `NEXTAUTH_SECRET` — JWT signing secret (required)
- `NEXTAUTH_URL` — App base URL
- `STORAGE_TYPE` — `local` or `s3`
- `DEFAULT_SLA_DAYS` — Default SLA deadline in days (30)

---

**Last updated**: 2026-02-20
