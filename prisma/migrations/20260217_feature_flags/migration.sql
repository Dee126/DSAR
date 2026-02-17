-- Sprint 9.5: Feature Flags
-- Tenant-scoped feature toggles with audit trail

-- Feature Flags table
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "id"         TEXT        NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"   TEXT        NOT NULL,
    "key"        TEXT        NOT NULL,
    "enabled"    BOOLEAN     NOT NULL DEFAULT false,
    "configJson" JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feature_flags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint: one flag per tenant per key
CREATE UNIQUE INDEX IF NOT EXISTS "feature_flags_tenantId_key_key" ON "feature_flags"("tenantId", "key");
CREATE INDEX IF NOT EXISTS "feature_flags_tenantId_idx" ON "feature_flags"("tenantId");

-- Feature Flag Audit table
CREATE TABLE IF NOT EXISTS "feature_flag_audits" (
    "id"              TEXT        NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"        TEXT        NOT NULL,
    "key"             TEXT        NOT NULL,
    "previousEnabled" BOOLEAN     NOT NULL,
    "newEnabled"      BOOLEAN     NOT NULL,
    "changedByUserId" TEXT        NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flag_audits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feature_flag_audits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "feature_flag_audits_tenantId_createdAt_idx" ON "feature_flag_audits"("tenantId", "createdAt" DESC);
