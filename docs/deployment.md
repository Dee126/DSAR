# Deployment Runbook

## Prerequisites

| Requirement | Version | Verify |
|---|---|---|
| Node.js | 20 LTS | `node -v` |
| PostgreSQL | 15+ | `psql --version` |
| npm | 10+ | `npm -v` |

## Environment Setup

1. Copy `.env.example` → `.env` and fill in all values
2. Validate environment:
   ```bash
   npx tsx -e "const {validateEnv}=require('./src/lib/env'); const r=validateEnv(); console.log(JSON.stringify(r,null,2))"
   ```

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | JWT signing secret (min 32 chars) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App public URL | `https://app.example.com` |

### Production-Required Variables

| Variable | Description |
|---|---|
| `PRIVACYPILOT_SECRET` | Encryption key for secrets (32 bytes base64): `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | Must NOT be the default placeholder |

### Conditional Variables

| Variable | Condition |
|---|---|
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Required when `STORAGE_TYPE=s3` |

## Deployment Steps

### 1. Install Dependencies

```bash
npm ci --production=false
```

### 2. Run Migration Preflight

```bash
npm run migrate:preflight
```

This verifies:
- DATABASE_URL is set and reachable
- Pending migrations are identified
- No unexpected destructive operations in migration SQL

### 3. Apply Database Migrations

```bash
# Production: use deploy (no interactive prompts)
npx prisma migrate deploy
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Build

```bash
npm run build
```

### 6. Start

```bash
npm start
# Or with a process manager:
# pm2 start npm --name "privacy-pilot" -- start
```

## Smoke Test Checklist

After deployment, verify:

- [ ] **Liveness probe**: `GET /api/health/liveness` → `200 { status: "alive" }`
- [ ] **Readiness probe**: `GET /api/health/readiness` → `200 { status: "ready" }`
- [ ] **Login**: Navigate to `/login`, sign in with valid credentials
- [ ] **Dashboard loads**: `/dashboard` renders stats without errors
- [ ] **Cases list**: `/cases` renders, pagination works
- [ ] **Create case**: Create a test case, verify it appears in the list
- [ ] **Status transition**: Transition test case through at least one state
- [ ] **Document upload**: Upload a test document to the case
- [ ] **Audit log**: Verify audit entries appear in `/settings` → Audit Logs
- [ ] **Feature flags**: Admin can view flags at `/settings` → Feature Flags
- [ ] **Metrics**: `GET /api/metrics` returns valid JSON (requires auth)

## Health Endpoints

| Endpoint | Purpose | Auth Required |
|---|---|---|
| `GET /api/health/liveness` | Process alive check | No |
| `GET /api/health/readiness` | All dependencies ready | No |
| `GET /api/metrics` | Application metrics | Yes (ASSURANCE_VIEW) |

## Kubernetes / Container Deployment

```yaml
livenessProbe:
  httpGet:
    path: /api/health/liveness
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/health/readiness
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `503` on readiness | DB unreachable | Check `DATABASE_URL`, network, pg status |
| `NEXTAUTH_SECRET` error | Missing or default secret | Set a random 32+ byte secret |
| Build fails on `prisma generate` | Schema out of sync | Run `npx prisma generate` manually |
| Feature flags show defaults | Migration not applied | Run `npx prisma migrate deploy` |
