-- CreateTable: integration_secrets
-- Stores encrypted provider credentials (AES-256-GCM blobs) for integrations.
-- One active secret per integration; old rows deleted on update.

CREATE TABLE "integration_secrets" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "encryptedBlob" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_secrets_integrationId_idx" ON "integration_secrets"("integrationId");

-- AddForeignKey
ALTER TABLE "integration_secrets"
    ADD CONSTRAINT "integration_secrets_integrationId_fkey"
    FOREIGN KEY ("integrationId")
    REFERENCES "integrations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
