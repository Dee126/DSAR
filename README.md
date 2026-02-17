# PrivacyPilot — DSAR Copilot

A production-grade MVP for managing GDPR Data Subject Access Requests (DSARs). Multi-tenant, role-based, auditable.

## Architecture

**Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
**Backend**: Next.js API Routes with Zod validation
**Database**: PostgreSQL via Prisma ORM
**Auth**: NextAuth.js v4 (credentials provider, JWT sessions)
**Storage**: Pluggable — local filesystem (dev), S3-compatible (prod)
**Testing**: Vitest (unit) + Playwright (E2E)

### Key Design Decisions

- **Multi-tenancy**: Every table includes `tenantId`. All queries filter by tenant derived from the authenticated session. No cross-tenant data leakage.
- **State machine**: DSAR cases follow a strict status workflow with logged transitions. Each transition requires a reason and is stored in the audit trail.
- **RBAC**: Six roles (SUPER_ADMIN → READ_ONLY) with granular permissions enforced server-side on every API endpoint.
- **Audit logging**: Every significant action (create, update, transition, upload, download, export, login) is recorded with timestamp, actor, IP, and details.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for PostgreSQL)

### 1. Clone & Install

```bash
git clone <repo-url> && cd DSAR
npm install
```

### 2. Start Database

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 with credentials from `.env.example`.

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

### 4. Initialize Database

```bash
npx prisma migrate dev --name init
# Or for quick prototyping:
npx prisma db push
```

### 5. Seed Demo Data

```bash
npm run db:seed
```

This creates:
- **Tenant**: Acme Corp
- **5 Users** (all password: `admin123456`):
  | Email | Role |
  |---|---|
  | admin@acme-corp.com | TENANT_ADMIN |
  | dpo@acme-corp.com | DPO |
  | manager@acme-corp.com | CASE_MANAGER |
  | contributor@acme-corp.com | CONTRIBUTOR |
  | viewer@acme-corp.com | READ_ONLY |
- **5 DSAR Cases** in various statuses with transitions, tasks, comments
- **3 Systems** (CRM, HR, Analytics)

### 6. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

## Project Structure

```
├── prisma/
│   ├── schema.prisma          # Data model (10 models, 6 enums)
│   └── seed.ts                # Demo data seeder
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # Authenticated pages (route group)
│   │   │   ├── dashboard/     # Overview stats + recent cases
│   │   │   ├── cases/         # List, create, detail views
│   │   │   ├── tasks/         # Cross-case task management
│   │   │   ├── documents/     # Cross-case document browser
│   │   │   └── settings/      # Tenant config, users, systems
│   │   ├── api/               # REST API routes
│   │   │   ├── auth/          # NextAuth handler
│   │   │   ├── cases/         # CRUD + transitions + export
│   │   │   ├── tasks/         # Task updates
│   │   │   ├── documents/     # Download
│   │   │   ├── users/         # User management
│   │   │   ├── data-subjects/ # Subject search
│   │   │   ├── systems/       # Processor map
│   │   │   └── audit-logs/    # Audit log viewer
│   │   └── login/             # Login page
│   ├── components/            # Shared UI components
│   ├── lib/                   # Core business logic
│   │   ├── auth.ts            # Session helpers
│   │   ├── auth-options.ts    # NextAuth config
│   │   ├── rbac.ts            # Role-based access control
│   │   ├── state-machine.ts   # DSAR status transitions
│   │   ├── audit.ts           # Audit log writer
│   │   ├── storage.ts         # File storage abstraction
│   │   ├── validation.ts      # Zod schemas
│   │   ├── errors.ts          # API error handling
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── utils.ts           # Helpers (case numbers, SLA)
│   └── types/
│       └── next-auth.d.ts     # Session type augmentation
├── tests/
│   ├── unit/
│   │   └── state-machine.test.ts   # State transition tests
│   └── e2e/
│       └── dsar-workflow.spec.ts   # Full workflow E2E
├── docker-compose.yml         # PostgreSQL for dev
├── .env.example               # Environment template
└── package.json
```

## DSAR Workflow (State Machine)

```
NEW ──→ IDENTITY_VERIFICATION ──→ INTAKE_TRIAGE ──→ DATA_COLLECTION ──→ REVIEW_LEGAL ──→ RESPONSE_PREPARATION ──→ RESPONSE_SENT ──→ CLOSED
 │              │                       │                                    │
 │              │                       │                                    │
 ├──→ INTAKE_TRIAGE (skip ID)          ├──→ REJECTED                        ├──→ DATA_COLLECTION (send back)
 │
 └──→ REJECTED ──→ CLOSED
```

Every transition requires a reason and is logged in the audit trail.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/[...nextauth]` | Authentication |
| GET/POST | `/api/cases` | List/create cases |
| GET/PATCH | `/api/cases/[id]` | Get/update case |
| POST | `/api/cases/[id]/transitions` | Transition case status |
| GET/POST | `/api/cases/[id]/tasks` | List/create tasks for case |
| GET/POST | `/api/cases/[id]/documents` | List/upload documents |
| GET/POST | `/api/cases/[id]/comments` | List/create comments |
| GET | `/api/cases/[id]/export` | Export evidence ZIP |
| PATCH | `/api/tasks/[id]` | Update task |
| GET | `/api/documents/[id]/download` | Download document |
| GET/POST | `/api/users` | List/create users |
| PATCH | `/api/users/[id]` | Update user |
| GET | `/api/data-subjects` | Search data subjects |
| GET/POST | `/api/systems` | List/create systems |
| PATCH/DELETE | `/api/systems/[id]` | Update/delete system |
| GET | `/api/audit-logs` | List audit logs |

All endpoints enforce authentication, tenant isolation, and RBAC.

## Reset Test User (Demo/Dev only)

If you cannot log in, reset the test user with:

```bash
npm run reset:test-user
```

**Required ENV**: `DATABASE_URL` must point to your PostgreSQL database.

This will upsert the following user (password is always reset):

| Email | Password | Role |
|---|---|---|
| `daniel.schormann@gmail.com` | `admin123` | TENANT_ADMIN |

**Safety**: The script refuses to run when `NODE_ENV=production` or `VERCEL_ENV=production`.

The build process (`npm run build`) also ensures this user exists via `prisma/ensure-admin.mjs`, so a fresh Vercel deploy will fix the login as well.

For the full auth architecture diagnosis, see [`docs/auth-diagnosis.md`](docs/auth-diagnosis.md).

## Running Tests

### Unit Tests

```bash
npm test
```

### E2E Tests

```bash
# Ensure the app is running with seeded data
npx playwright install chromium
npm run test:e2e
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://privacy_pilot:privacy_pilot_dev@localhost:5432/privacy_pilot` |
| `NEXTAUTH_SECRET` | JWT signing secret | (required) |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` |
| `STORAGE_TYPE` | `local` or `s3` | `local` |
| `STORAGE_LOCAL_PATH` | Local file storage path | `./uploads` |
| `DEFAULT_SLA_DAYS` | Default SLA deadline (days) | `30` |

## Roles & Permissions

| Role | Cases | Tasks | Docs | Users | Settings | Export | Audit |
|------|-------|-------|------|-------|----------|--------|-------|
| SUPER_ADMIN | Full | Full | Full | Full | Full | Yes | Yes |
| TENANT_ADMIN | Full | Full | Full | Full | Read/Write | Yes | Yes |
| DPO | CRU | CRU | CRU | Read | Read | Yes | Yes |
| CASE_MANAGER | CRU | CRU | CR | Read | — | Yes | — |
| CONTRIBUTOR | Read | RU | CR | — | — | — | — |
| READ_ONLY | Read | Read | Read | — | — | — | — |

CRU = Create, Read, Update

## Assumptions

- Single-tenant seed for MVP; multi-tenant infrastructure is fully in place.
- S3 storage is stubbed with local filesystem fallback; code is structured for real S3.
- No email notifications in MVP (placeholder for future).
- Password-based auth only; SSO placeholder via NextAuth provider config.
- File viewer uses browser-native capabilities (iframe for PDFs, img for images).

## License

Proprietary — internal use only.
