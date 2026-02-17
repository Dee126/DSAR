# Database Migrations Guide

## Migration Workflow

Follow this order for every deployment that includes schema changes:

```
1. BACKUP → pg_dump before any changes
2. PREFLIGHT → Run migrate:preflight
3. MIGRATE → Apply migrations
4. VERIFY → Check migration status
5. DEPLOY → Deploy new application code
6. SMOKE TEST → Verify application works
```

## Step-by-Step

### 1. Pre-Migration Backup

```bash
# Create a timestamped backup
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="backup_$(date +%Y%m%d_%H%M%S).dump"
```

### 2. Run Preflight Checks

```bash
npm run migrate:preflight
```

The preflight script checks:
- `DATABASE_URL` is set
- Database is reachable
- Pending migration count
- Scans for destructive SQL operations (DROP TABLE, TRUNCATE, DELETE FROM)

If the preflight reports warnings about destructive operations, **review those migrations manually** before proceeding.

### 3. Apply Migrations

```bash
# Development (interactive, creates migration files)
npx prisma migrate dev

# Production (non-interactive, applies pending migrations)
npx prisma migrate deploy
```

### 4. Verify

```bash
npx prisma migrate status
```

Expected output: "Database schema is up to date"

### 5. Regenerate Prisma Client

```bash
npx prisma generate
```

This is automatically run during `npm run build` but can be run manually if needed.

## Creating New Migrations

### Via Prisma Migrate (Recommended)

1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. Review generated SQL in `prisma/migrations/<timestamp>_descriptive_name/migration.sql`
4. Commit the migration file

### Manual SQL Migrations

If needed, create a migration directory manually:

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d)_description
```

Write `migration.sql` with:
- `IF NOT EXISTS` guards for idempotency
- Comments explaining the change
- No destructive operations without team review

### Migration Naming Convention

```
YYYYMMDD_short_description
```

Examples:
- `20260217_feature_flags`
- `20260301_add_retention_policy_index`

## Destructive Migration Checklist

If a migration includes DROP, TRUNCATE, or DELETE:

- [ ] Is the data truly no longer needed?
- [ ] Has a backup been created?
- [ ] Has the migration been tested in staging?
- [ ] Has the migration been reviewed by a second engineer?
- [ ] Is there a rollback plan (reverse migration SQL)?
- [ ] Have affected tenants been notified (if applicable)?

## Troubleshooting

| Issue | Resolution |
|---|---|
| "Migration failed to apply cleanly" | Check the error, fix the SQL, mark as resolved with `prisma migrate resolve` |
| "Drift detected" | Schema differs from migrations. Run `prisma migrate diff` to see changes |
| Migration timeout | Break large migrations into smaller steps, increase statement timeout |
| "Table already exists" | Use `CREATE TABLE IF NOT EXISTS` in custom SQL |

## Rollback

Prisma Migrate does not support automatic rollback. For emergency rollback:

1. Restore from pre-migration backup:
   ```bash
   pg_restore --clean --if-exists -d "$DATABASE_URL" backup_file.dump
   ```
2. Revert application code to match the old schema
3. Mark the failed migration as rolled back:
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```
