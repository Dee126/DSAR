# Backup & Restore Guide

## Database Backup

### Full Database Backup (pg_dump)

```bash
# Custom format (compressed, supports selective restore)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="privacy_pilot_$(date +%Y%m%d_%H%M%S).dump"

# SQL format (human-readable, useful for review)
pg_dump "$DATABASE_URL" \
  --format=plain \
  --file="privacy_pilot_$(date +%Y%m%d_%H%M%S).sql"
```

### Automated Backup Schedule

Recommended backup frequency:

| Environment | Frequency | Retention |
|---|---|---|
| Production | Daily (full) + hourly (WAL) | 30 days full, 7 days WAL |
| Staging | Daily | 7 days |
| Development | Before destructive operations | As needed |

### Example Cron Job

```bash
# Daily full backup at 02:00 UTC
0 2 * * * pg_dump "$DATABASE_URL" --format=custom \
  --file="/backups/privacy_pilot_$(date +\%Y\%m\%d).dump" 2>&1 | logger -t pg_backup

# Clean up backups older than 30 days
0 3 * * * find /backups -name "privacy_pilot_*.dump" -mtime +30 -delete
```

## Database Restore

### Full Restore

```bash
# Restore from custom format
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  -d "$DATABASE_URL" \
  backup_file.dump

# Restore from SQL format
psql "$DATABASE_URL" < backup_file.sql
```

### Selective Table Restore

```bash
# List tables in backup
pg_restore --list backup_file.dump

# Restore specific table
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --table=dsar_cases \
  -d "$DATABASE_URL" \
  backup_file.dump
```

## Document Storage Backup

### Local Storage

```bash
# Backup uploads directory
tar -czf "uploads_$(date +%Y%m%d_%H%M%S).tar.gz" ./uploads/
```

### S3 Storage

```bash
# Sync to backup bucket
aws s3 sync \
  "s3://$S3_BUCKET" \
  "s3://${S3_BUCKET}-backup/$(date +%Y%m%d)" \
  --region "$S3_REGION"

# Or download locally
aws s3 sync \
  "s3://$S3_BUCKET" \
  "./backup_s3_$(date +%Y%m%d)/" \
  --region "$S3_REGION"
```

## Tenant Configuration Export/Import

### Export Tenant Configuration

Use the built-in tenant config export endpoint:

```bash
# Requires TENANT_ADMIN authentication
curl -H "Authorization: Bearer <token>" \
  "https://app.example.com/api/admin/tenant/<tenant-id>/export" \
  -o "tenant_config_$(date +%Y%m%d).json"
```

The export includes:
- Tenant settings (SLA days, retention)
- Feature flag states
- SLA configuration
- Retention policies
- Webhook endpoints (secrets redacted)
- Connector configurations (secrets redacted)
- IDV / delivery / intake settings

### Import Tenant Configuration

Currently, tenant config import is manual. Use the exported JSON as reference to reconfigure via the admin UI or API endpoints.

## Retention & Legal Hold

### Data Retention

The platform enforces tenant-specific retention policies configured in the admin panel:

- Default retention: controlled by `retentionDays` on the Tenant model
- Per-case retention: cases in CLOSED status are eligible for cleanup after retention period
- Documents: follow the case retention period
- Audit logs: retained independently (typically longer than case data)

### Legal Hold

When a legal hold is active:

1. **Do NOT delete** any cases, documents, or audit logs for the affected tenant
2. Suspend automated retention cleanup for the tenant
3. Document the hold in the incident tracking system
4. Only release the hold with explicit legal approval

### Retention Cleanup

Automated retention cleanup (when implemented) should:

1. Only target cases in `CLOSED` or `REJECTED` status
2. Respect the tenant's `retentionDays` setting
3. Never delete audit logs during case cleanup
4. Log all deletions to the audit trail
5. Skip cases under legal hold

## Disaster Recovery Checklist

- [ ] Database backup exists and is recent (< 24h)
- [ ] Document storage backup exists (local or S3)
- [ ] Backup can be restored successfully (test quarterly)
- [ ] Tenant configs can be re-exported
- [ ] Environment variables are documented (not just in `.env`)
- [ ] DNS / load balancer can be redirected to DR environment
- [ ] Team knows the recovery procedure (this document)
