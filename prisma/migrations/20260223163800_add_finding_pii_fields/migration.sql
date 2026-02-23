-- CreateEnum
CREATE TYPE "ConnectorCategory" AS ENUM ('M365', 'EXCHANGE', 'SHAREPOINT', 'FILESERVER', 'CRM');

-- CreateEnum
CREATE TYPE "ConnectorRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "FindingStatus_new" AS ENUM ('OPEN', 'ACCEPTED', 'MITIGATING', 'MITIGATED');
ALTER TABLE "findings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "findings" ALTER COLUMN "status" TYPE "FindingStatus_new" USING ("status"::text::"FindingStatus_new");
ALTER TYPE "FindingStatus" RENAME TO "FindingStatus_old";
ALTER TYPE "FindingStatus_new" RENAME TO "FindingStatus";
DROP TYPE "FindingStatus_old";
ALTER TABLE "findings" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterTable
ALTER TABLE "findings" ADD COLUMN     "dataAssetId" TEXT,
ADD COLUMN     "piiCategory" TEXT,
ADD COLUMN     "piiCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sensitivityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "snippetPreview" TEXT,
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "finding_audit_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "comment" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connectors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ConnectorCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "status" "ConnectorRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "assetsFound" INTEGER NOT NULL DEFAULT 0,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_credentials" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'default',
    "encryptedBlob" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finding_audit_events_tenantId_findingId_idx" ON "finding_audit_events"("tenantId", "findingId");

-- CreateIndex
CREATE INDEX "connectors_tenantId_idx" ON "connectors"("tenantId");

-- CreateIndex
CREATE INDEX "connector_runs_tenantId_idx" ON "connector_runs"("tenantId");

-- CreateIndex
CREATE INDEX "connector_runs_connectorId_idx" ON "connector_runs"("connectorId");

-- CreateIndex
CREATE INDEX "connector_credentials_connectorId_idx" ON "connector_credentials"("connectorId");

-- CreateIndex
CREATE INDEX "findings_tenantId_dataAssetId_idx" ON "findings"("tenantId", "dataAssetId");

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_dataAssetId_fkey" FOREIGN KEY ("dataAssetId") REFERENCES "data_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_audit_events" ADD CONSTRAINT "finding_audit_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_audit_events" ADD CONSTRAINT "finding_audit_events_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_audit_events" ADD CONSTRAINT "finding_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_runs" ADD CONSTRAINT "connector_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_runs" ADD CONSTRAINT "connector_runs_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_credentials" ADD CONSTRAINT "connector_credentials_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
