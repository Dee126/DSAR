-- Module 8.5: Enterprise Search & eDiscovery
-- CreateEnum
CREATE TYPE "SearchEntityType" AS ENUM ('CASE', 'INCIDENT', 'VENDOR_REQUEST', 'DOCUMENT', 'SYSTEM', 'INTAKE', 'RESPONSE', 'AUDIT');

-- CreateEnum
CREATE TYPE "SavedSearchVisibility" AS ENUM ('PRIVATE', 'TEAM', 'TENANT');

-- CreateEnum
CREATE TYPE "SearchViewScope" AS ENUM ('ALL', 'CASES', 'INCIDENTS', 'VENDORS', 'DOCUMENTS', 'SYSTEMS', 'INTAKE', 'RESPONSES', 'AUDIT');

-- CreateTable
CREATE TABLE "search_index_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "SearchEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_index_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "queryText" TEXT NOT NULL DEFAULT '',
    "filtersJson" JSONB,
    "sortJson" JSONB,
    "visibility" "SavedSearchVisibility" NOT NULL DEFAULT 'PRIVATE',
    "pinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_views" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityScope" "SearchViewScope" NOT NULL DEFAULT 'ALL',
    "defaultFiltersJson" JSONB,
    "columnsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_index_entries_tenantId_entityType_entityId_key" ON "search_index_entries"("tenantId", "entityType", "entityId");
CREATE INDEX "search_index_entries_tenantId_idx" ON "search_index_entries"("tenantId");
CREATE INDEX "search_index_entries_tenantId_entityType_idx" ON "search_index_entries"("tenantId", "entityType");
CREATE INDEX "search_index_entries_tenantId_updatedAt_idx" ON "search_index_entries"("tenantId", "updatedAt");

CREATE INDEX "saved_searches_tenantId_idx" ON "saved_searches"("tenantId");
CREATE INDEX "saved_searches_tenantId_createdBy_idx" ON "saved_searches"("tenantId", "createdBy");
CREATE INDEX "saved_searches_tenantId_visibility_idx" ON "saved_searches"("tenantId", "visibility");

CREATE INDEX "search_views_tenantId_idx" ON "search_views"("tenantId");

-- AddForeignKey
ALTER TABLE "search_index_entries" ADD CONSTRAINT "search_index_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "search_views" ADD CONSTRAINT "search_views_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Full-Text Search: tsvector column + GIN index ──────────────────────────
ALTER TABLE "search_index_entries" ADD COLUMN "fts_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("bodyText", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string("tags", ' '), '')), 'C')
  ) STORED;

CREATE INDEX "search_index_entries_fts_idx" ON "search_index_entries" USING GIN ("fts_vector");

-- ─── Trigram extension for fuzzy/ILIKE fallback ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "search_index_entries_title_trgm_idx" ON "search_index_entries" USING GIN ("title" gin_trgm_ops);
