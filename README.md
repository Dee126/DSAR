# PrivacyPilot — DSAR Copilot

A production-grade MVP for managing GDPR Data Subject Access Requests (DSARs). Multi-tenant, role-based, auditable.

## Architecture

**Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
**Backend**: Next.js API Routes with Zod validation
**Database**: PostgreSQL via Prisma ORM
**Auth**: Dual-mode — Test auth (HMAC cookies, no DB) or NextAuth.js v4 (Supabase/Prisma)
**Storage**: Pluggable — local filesystem (dev), S3-compatible (prod)
**Testing**: Vitest (unit) + Playwright (E2E)

### Key Design Decisions

- **Multi-tenancy**: Every table includes `tenantId`. All queries filter by tenant derived from the authenticated session. No cross-tenant data leakage.
- **State machine**: DSAR cases follow a strict status workflow with logged transitions. Each transition requires a reason and is stored in the audit trail.
- **RBAC**: Six roles (SUPER_ADMIN → READ_ONLY) with granular permissions enforced server-side on every API endpoint.
- **Audit logging**: Every significant action (create, update, transition, upload, download, export, login) is recorded with timestamp, actor, IP, and details.

## Quick Start (Test Auth — No Database Required)

The fastest way to run the app locally. No PostgreSQL or Supabase needed.

### Prerequisites

- Node.js 18+

### Steps

```bash
git clone <repo-url> && cd DSAR
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with:
- **Email**: `daniel.schormann@gmail.com`
- **Password**: `admin123`

These credentials come from `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `.env`.

> **Note**: In test auth mode, API routes that query the database (cases, tasks, etc.)
> will fail unless PostgreSQL is running. But authentication and protected page access
> work without any database.

### Required Env Vars (Test Mode)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_AUTH_MODE` | `"test"` or `"supabase"` | `"test"` |
| `AUTH_SECRET` | HMAC signing secret for cookies | `"dev-secret-change-me"` |
| `TEST_USER_EMAIL` | Login email for test mode | (required) |
| `TEST_USER_PASSWORD` | Login password for test mode | (required) |

## Quick Start (Full Stack with Database)

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
| `NEXT_PUBLIC_AUTH_MODE` | `"test"` (HMAC cookies) or `"supabase"` (NextAuth) | `"test"` |
| `AUTH_SECRET` | HMAC signing key (test mode) | (required in test mode) |
| `TEST_USER_EMAIL` | Test login email | (required in test mode) |
| `TEST_USER_PASSWORD` | Test login password | (required in test mode) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://privacy_pilot:privacy_pilot_dev@localhost:5432/privacy_pilot` |
| `NEXTAUTH_SECRET` | JWT signing secret (supabase mode) | (required in supabase mode) |
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

## Discovery & Heatmap (MVP)

The discovery module adds PII scanning and heatmap visualization across connected systems. It uses raw SQL migrations (not Prisma) and is accessed via the Supabase client.

### Data Model

| Table | Purpose |
|---|---|
| `data_assets` | Files, records, mailboxes discovered in systems |
| `discovery_findings` | PII detections within data assets (sensitivity 0-100) |
| `scan_jobs` | Background scan runs per system |
| `dsar_case_items` | Links DSAR cases to specific data assets |
| `v_discovery_heatmap` | Aggregated view for heatmap dashboard |

> **Note**: The table is named `discovery_findings` (not `findings`) to avoid conflict with the existing Copilot `findings` table managed by Prisma.

### Setup

```bash
# 1. Ensure database is running and Prisma schema is applied
npm run docker:up
npx prisma db push

# 2. Run discovery migration + seed (creates tables, RLS, and demo data)
npm run seed:discovery

# 3. Or run steps separately:
npm run seed:discovery -- --migrate-only   # tables + RLS only
npm run seed:discovery -- --seed-only      # demo data only (tables must exist)
```

### Seed Data

The seed creates:
- **4 systems**: Microsoft 365, Corporate Fileserver, HR-CRM, Exchange Online
- **50 data assets** across all systems (SharePoint docs, mailboxes, employee records, etc.)
- **200 discovery findings** with realistic distribution: 70% green (0-30), 20% yellow (31-60), 10% red (61-100)
- **8 scan jobs** (completed, running, queued, failed)
- **38 DSAR case items** linking the 20 demo cases to relevant data assets

### Prisma vs Supabase Client

Prisma is retained for the core DSAR workflow (cases, tasks, documents, auth, audit logging) — it is deeply integrated across all API routes and repositories. The discovery/heatmap module uses the Supabase client directly (`src/lib/supabase/server.ts`) because:
1. The discovery tables are managed via raw SQL migrations, not Prisma
2. The Supabase client is already configured and provides RLS-aware access
3. Clean separation: Prisma for DSAR workflow, Supabase for discovery/heatmap

### RLS Policies

- **RLS enabled** on all discovery tables
- **MVP**: Authenticated users get full CRUD access (single-tenant demo)
- **Service role** (used by API routes): bypasses RLS entirely
- **Anon role**: implicit deny (no policy = 0 rows)
- **Future**: tenant-scoped policies via `pp_tenant_id()` (prepared with `tenant_id` columns)

## Local VM MVP Setup

Run the full stack locally with Docker Compose (Postgres) + Prisma — **no Supabase dependency**.

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16 (via Docker Compose or native install)

### Step-by-step

```bash
# 1. Clone and install
git clone <repo-url> && cd DSAR
npm install

# 2. Start PostgreSQL
docker compose up -d
# Or if using a native Postgres, create the user + database:
#   CREATE USER privacy_pilot WITH PASSWORD 'privacy_pilot_dev' CREATEDB;
#   CREATE DATABASE privacy_pilot OWNER privacy_pilot;

# 3. Create .env from template
cp .env.example .env
# Defaults work for local dev — key settings:
#   DATABASE_URL=postgresql://privacy_pilot:privacy_pilot_dev@localhost:5432/privacy_pilot
#   DIRECT_URL=<same as DATABASE_URL for local dev>
#   USE_SUPABASE=false

# 4. Push schema to database (creates all tables)
npx prisma db push

# 5. Seed demo data
npm run db:seed

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with any of the demo accounts.

### Demo Accounts

| Email | Password | Role |
|---|---|---|
| `admin@acme-corp.com` | `admin123456` | TENANT_ADMIN |
| `dpo@acme-corp.com` | `admin123456` | DPO |
| `manager@acme-corp.com` | `admin123456` | CASE_MANAGER |
| `contributor@acme-corp.com` | `admin123456` | CONTRIBUTOR |
| `viewer@acme-corp.com` | `admin123456` | READ_ONLY |

### Seeded Data Summary

| Entity | Count | Notes |
|---|---|---|
| DSAR Cases | 20 | Various statuses (NEW, DATA_COLLECTION, CLOSED, etc.) |
| Data Subjects | 19 | EU + international names |
| Data Assets | 51 | Across M365, Fileserver, HR-CRM, CRM |
| Findings | 203 | ~60% green, ~25% yellow, ~15% red |
| Case Items | 106+ | Linking cases to findings |
| Systems | 10 | CRM, HR, M365, Analytics, etc. |
| Scan Jobs | 5 | 4 completed + 1 running |
| Audit Events | 47+ | Case lifecycle events |

### Supabase Feature Flag

The MVP runs entirely on Prisma + local Postgres. Supabase is isolated behind `USE_SUPABASE`:

- `USE_SUPABASE=false` (default): All Supabase clients return `null`/throw early. The app uses Prisma only.
- `USE_SUPABASE=true` + valid credentials: Supabase clients are available for the discovery/heatmap module.

The Supabase code is **not deleted** — it is gated behind `isSupabaseEnabled()`, `isBrowserSupabaseConfigured()`, and `isServerSupabaseConfigured()` checks.

### Useful Commands

```bash
npm run dev              # Start Next.js dev server
npm run db:seed          # Re-seed demo data (destructive)
npx prisma db push       # Push schema changes to DB
npx prisma studio        # Visual database browser
npm test                 # Run unit tests
npm run lint             # ESLint
```

## Assumptions

- Single-tenant seed for MVP; multi-tenant infrastructure is fully in place.
- S3 storage is stubbed with local filesystem fallback; code is structured for real S3.
- No email notifications in MVP (placeholder for future).
- Password-based auth only; SSO placeholder via NextAuth provider config.
- File viewer uses browser-native capabilities (iframe for PDFs, img for images).

## License

Proprietary — internal use only.
