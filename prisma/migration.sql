-- ═══════════════════════════════════════════════════════════════
-- FULL CLEANUP: Drop everything first for a clean slate
-- ═══════════════════════════════════════════════════════════════
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'DPO', 'CASE_MANAGER', 'ANALYST', 'AUDITOR', 'CONTRIBUTOR', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "DSARType" AS ENUM ('ACCESS', 'ERASURE', 'RECTIFICATION', 'RESTRICTION', 'PORTABILITY', 'OBJECTION');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('NEW', 'IDENTITY_VERIFICATION', 'INTAKE_TRIAGE', 'DATA_COLLECTION', 'REVIEW_LEGAL', 'RESPONSE_PREPARATION', 'RESPONSE_SENT', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "DocumentClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'LETTER', 'PORTAL', 'PHONE');

-- CreateEnum
CREATE TYPE "DataCollectionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "LegalReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('M365', 'EXCHANGE_ONLINE', 'SHAREPOINT', 'ONEDRIVE', 'GOOGLE_WORKSPACE', 'SALESFORCE', 'SERVICENOW', 'ATLASSIAN_JIRA', 'ATLASSIAN_CONFLUENCE', 'WORKDAY', 'SAP_SUCCESSFACTORS', 'OKTA', 'AWS', 'AZURE', 'GCP');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CopilotRunStatus" AS ENUM ('DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CopilotQueryStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DataCategory" AS ENUM ('IDENTIFICATION', 'CONTACT', 'CONTRACT', 'PAYMENT', 'COMMUNICATION', 'HR', 'CREDITWORTHINESS', 'ONLINE_TECHNICAL', 'HEALTH', 'RELIGION', 'UNION', 'POLITICAL_OPINION', 'OTHER_SPECIAL_CATEGORY', 'OTHER');

-- CreateEnum
CREATE TYPE "LegalApprovalStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QueryIntent" AS ENUM ('DATA_LOCATION', 'DSAR_SUMMARY', 'CATEGORY_OVERVIEW', 'RISK_CHECK', 'EXPORT_PREP', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceItemType" AS ENUM ('EMAIL', 'FILE', 'RECORD', 'CALENDAR', 'CONTACT', 'TICKET', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentHandling" AS ENUM ('NONE', 'METADATA_ONLY', 'CONTENT_STORED');

-- CreateEnum
CREATE TYPE "PrimaryIdentifierType" AS ENUM ('EMAIL', 'UPN', 'OBJECT_ID', 'CUSTOMER_ID', 'EMPLOYEE_ID', 'PHONE', 'IBAN', 'OTHER');

-- CreateEnum
CREATE TYPE "CopilotSummaryType" AS ENUM ('LOCATION_OVERVIEW', 'CATEGORY_OVERVIEW', 'DSAR_DRAFT', 'RISK_SUMMARY');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('ZIP', 'DOCX', 'XLSX', 'PDF', 'JSON', 'CSV');

-- CreateEnum
CREATE TYPE "ExportLegalGateStatus" AS ENUM ('BLOCKED', 'ALLOWED');

-- CreateEnum
CREATE TYPE "IntegrationHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'FAILED', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "EscalationSeverity" AS ENUM ('YELLOW_WARNING', 'RED_ALERT', 'OVERDUE_BREACH');

-- CreateEnum
CREATE TYPE "DeadlineEventType" AS ENUM ('CREATED', 'RECALCULATED', 'EXTENDED', 'PAUSED', 'RESUMED', 'MILESTONE_COMPLETED', 'MILESTONE_MISSED');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('IDV_COMPLETE', 'COLLECTION_COMPLETE', 'DRAFT_READY', 'LEGAL_REVIEW_DONE', 'RESPONSE_SENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ESCALATION', 'DEADLINE_WARNING', 'EXTENSION_REQUEST', 'MILESTONE_DUE', 'OVERDUE', 'INFO');

-- CreateEnum
CREATE TYPE "IdvRequestStatus" AS ENUM ('NOT_STARTED', 'LINK_SENT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEED_MORE_INFO');

-- CreateEnum
CREATE TYPE "IdvMethod" AS ENUM ('EMAIL_OTP', 'DOC_UPLOAD', 'UTILITY_BILL', 'SELFIE_MATCH', 'KNOWLEDGE_BASED');

-- CreateEnum
CREATE TYPE "IdvArtifactType" AS ENUM ('ID_FRONT', 'ID_BACK', 'PASSPORT', 'DRIVERS_LICENSE', 'UTILITY_BILL', 'SELFIE', 'OTHER_DOCUMENT');

-- CreateEnum
CREATE TYPE "IdvDecisionOutcome" AS ENUM ('APPROVED', 'REJECTED', 'NEED_MORE_INFO');

-- CreateEnum
CREATE TYPE "SystemCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SystemStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AutomationReadiness" AS ENUM ('MANUAL', 'SEMI_AUTOMATED', 'API_AVAILABLE');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('NONE', 'MOCK', 'M365', 'GOOGLE', 'SALESFORCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LawfulBasis" AS ENUM ('CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTERESTS', 'PUBLIC_INTEREST', 'LEGITIMATE_INTERESTS');

-- CreateEnum
CREATE TYPE "ProcessorRole" AS ENUM ('PROCESSOR', 'SUBPROCESSOR');

-- CreateEnum
CREATE TYPE "RedactionStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BreakGlassEventType" AS ENUM ('RATE_LIMIT_EXCEEDED', 'ANOMALY_MANY_RUNS', 'ANOMALY_MANY_SUBJECTS', 'ANOMALY_PERMISSION_DENIED', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'CONTAINED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentTimelineEventType" AS ENUM ('DETECTED', 'TRIAGED', 'CONTAINED', 'NOTIFIED_AUTHORITY', 'NOTIFIED_SUBJECTS', 'REMEDIATION', 'CLOSED', 'OTHER');

-- CreateEnum
CREATE TYPE "RegulatorRecordStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'INQUIRY', 'CLOSED');

-- CreateEnum
CREATE TYPE "IncidentSourceType" AS ENUM ('MANUAL', 'IMPORT_JIRA', 'IMPORT_SERVICENOW', 'IMPORT_SIEM', 'IMPORT_OTHER');

-- CreateEnum
CREATE TYPE "DsarIncidentSubjectStatus" AS ENUM ('UNKNOWN', 'YES', 'NO');

-- CreateEnum
CREATE TYPE "AuthorityExportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ResponseDocStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SENT');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('EMAIL', 'POSTAL', 'PORTAL', 'API');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "VendorRequestStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RESPONDED', 'RESPONDED', 'OVERDUE', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VendorRequestItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "VendorResponseType" AS ENUM ('DATA_EXTRACT', 'CONFIRMATION', 'PARTIAL', 'REJECTION', 'QUESTION');

-- CreateEnum
CREATE TYPE "VendorEscalationSeverity" AS ENUM ('WARNING', 'CRITICAL', 'BREACH');

-- CreateEnum
CREATE TYPE "KpiSnapshotPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'CSV', 'JSON', 'PPT_JSON');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MaturityDomain" AS ENUM ('DOCUMENTATION', 'AUTOMATION', 'SLA_COMPLIANCE', 'INCIDENT_INTEGRATION', 'VENDOR_COORDINATION');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slaDefaultDays" INTEGER NOT NULL DEFAULT 30,
    "dueSoonDays" INTEGER NOT NULL DEFAULT 7,
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'READ_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subjects" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "preferredLanguage" TEXT DEFAULT 'en',
    "identifiers" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_cases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "type" "DSARType" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'NEW',
    "priority" "CasePriority" NOT NULL DEFAULT 'MEDIUM',
    "lawfulBasis" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "extendedDueDate" TIMESTAMP(3),
    "extensionReason" TEXT,
    "channel" TEXT,
    "requesterType" TEXT,
    "description" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dataSubjectId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT,

    CONSTRAINT "dsar_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_state_transitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" "CaseStatus" NOT NULL,
    "toStatus" "CaseStatus" NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "dsar_state_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "systemId" TEXT,
    "assigneeUserId" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "classification" "DocumentClassification" NOT NULL DEFAULT 'INTERNAL',
    "tags" JSONB,
    "deletedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "details" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "systems" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "contactEmail" TEXT,
    "tags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerUserId" TEXT,
    "criticality" "SystemCriticality" NOT NULL DEFAULT 'MEDIUM',
    "systemStatus" "SystemStatus" NOT NULL DEFAULT 'ACTIVE',
    "containsSpecialCategories" BOOLEAN NOT NULL DEFAULT false,
    "inScopeForDsar" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "automationReadiness" "AutomationReadiness" NOT NULL DEFAULT 'MANUAL',
    "connectorType" "ConnectorType" NOT NULL DEFAULT 'NONE',
    "exportFormats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedCollectionTimeMinutes" INTEGER,
    "dataResidencyPrimary" TEXT,
    "processingRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "thirdCountryTransfers" BOOLEAN NOT NULL DEFAULT false,
    "thirdCountryTransferDetails" TEXT,
    "identifierTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_data_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "category" "DataCategory" NOT NULL,
    "customCategoryName" TEXT,
    "processingPurpose" TEXT,
    "lawfulBasis" "LawfulBasis" NOT NULL DEFAULT 'LEGITIMATE_INTERESTS',
    "retentionPeriod" TEXT,
    "retentionDays" INTEGER,
    "dsarRelevanceAccess" BOOLEAN NOT NULL DEFAULT true,
    "dsarRelevanceErasure" BOOLEAN NOT NULL DEFAULT true,
    "dsarRelevanceRectification" BOOLEAN NOT NULL DEFAULT false,
    "dsarRelevancePortability" BOOLEAN NOT NULL DEFAULT false,
    "dsarRelevanceRestriction" BOOLEAN NOT NULL DEFAULT false,
    "dsarRelevanceObjection" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_data_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_processors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorId" TEXT,
    "role" "ProcessorRole" NOT NULL DEFAULT 'PROCESSOR',
    "contractReference" TEXT,
    "dpaOnFile" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_processors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dsarTypes" "DSARType"[],
    "dataSubjectTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "identifierTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conditions" JSONB,
    "systemId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_system_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "collectionStatus" "DataCollectionStatus" NOT NULL DEFAULT 'PENDING',
    "suggestedByDiscovery" BOOLEAN NOT NULL DEFAULT false,
    "discoveryScore" DOUBLE PRECISION,
    "discoveryReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_system_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_collection_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "systemId" TEXT,
    "integrationId" TEXT,
    "systemLabel" TEXT,
    "querySpec" JSONB,
    "status" "DataCollectionStatus" NOT NULL DEFAULT 'PENDING',
    "findingsSummary" TEXT,
    "recordsFound" INTEGER,
    "resultMetadata" JSONB,
    "assignedToUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "LegalReviewStatus" NOT NULL DEFAULT 'PENDING',
    "issues" TEXT,
    "exemptionsApplied" JSONB,
    "redactions" TEXT,
    "notes" TEXT,
    "reviewerUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISABLED',
    "config" JSONB,
    "secretRef" TEXT,
    "healthStatus" "IntegrationHealthStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_secrets" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "encryptedBlob" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "CopilotRunStatus" NOT NULL DEFAULT 'DRAFT',
    "justification" TEXT NOT NULL,
    "scopeSummary" TEXT,
    "providerSelection" JSONB,
    "resultSummary" TEXT,
    "errorDetails" TEXT,
    "containsSpecialCategory" BOOLEAN NOT NULL DEFAULT false,
    "legalApprovalStatus" "LegalApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "legalApprovedByUserId" TEXT,
    "legalApprovedAt" TIMESTAMP(3),
    "retentionDeleteAt" TIMESTAMP(3),
    "totalFindings" INTEGER NOT NULL DEFAULT 0,
    "totalEvidenceItems" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_queries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "queryIntent" "QueryIntent" NOT NULL DEFAULT 'DATA_LOCATION',
    "subjectIdentityId" TEXT,
    "executionMode" "ContentHandling" NOT NULL DEFAULT 'METADATA_ONLY',
    "constraints" JSONB,
    "integrationId" TEXT,
    "provider" TEXT,
    "querySpec" JSONB,
    "status" "CopilotQueryStatus" NOT NULL DEFAULT 'PENDING',
    "recordsFound" INTEGER,
    "errorMessage" TEXT,
    "executionMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "primaryIdentifierType" "PrimaryIdentifierType" NOT NULL DEFAULT 'EMAIL',
    "primaryIdentifierValue" TEXT NOT NULL,
    "alternateIdentifiers" JSONB NOT NULL,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "queryId" TEXT,
    "integrationId" TEXT,
    "provider" TEXT NOT NULL,
    "workload" TEXT,
    "itemType" "EvidenceItemType" NOT NULL DEFAULT 'OTHER',
    "externalRef" TEXT,
    "location" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAtSource" TIMESTAMP(3),
    "modifiedAtSource" TIMESTAMP(3),
    "owners" JSONB,
    "metadata" JSONB,
    "contentHandling" "ContentHandling" NOT NULL DEFAULT 'METADATA_ONLY',
    "linkedDocumentId" TEXT,
    "sensitivityScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detector_results" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "evidenceItemId" TEXT NOT NULL,
    "detectorType" TEXT NOT NULL,
    "detectedElements" JSONB NOT NULL,
    "detectedCategories" JSONB NOT NULL,
    "containsSpecialCategorySuspected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detector_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "dataCategory" "DataCategory" NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'INFO',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "evidenceItemIds" TEXT[],
    "containsSpecialCategory" BOOLEAN NOT NULL DEFAULT false,
    "containsThirdPartyDataSuspected" BOOLEAN NOT NULL DEFAULT false,
    "requiresLegalReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_summaries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "summaryType" "CopilotSummaryType" NOT NULL,
    "content" TEXT NOT NULL,
    "evidenceSnapshotHash" TEXT NOT NULL,
    "disclaimerIncluded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_artifacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "documentId" TEXT,
    "exportType" "ExportType" NOT NULL DEFAULT 'JSON',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "legalGateStatus" "ExportLegalGateStatus" NOT NULL DEFAULT 'ALLOWED',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_governance_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "copilotEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedProviderPhases" JSONB NOT NULL DEFAULT '[1]',
    "defaultExecutionMode" TEXT NOT NULL DEFAULT 'METADATA_ONLY',
    "allowContentScanning" BOOLEAN NOT NULL DEFAULT false,
    "allowOcr" BOOLEAN NOT NULL DEFAULT false,
    "allowLlmSummaries" BOOLEAN NOT NULL DEFAULT false,
    "maxRunsPerDayTenant" INTEGER NOT NULL DEFAULT 100,
    "maxRunsPerDayUser" INTEGER NOT NULL DEFAULT 20,
    "maxEvidenceItemsPerRun" INTEGER NOT NULL DEFAULT 10000,
    "maxContentScanBytes" INTEGER NOT NULL DEFAULT 512000,
    "maxConcurrentRuns" INTEGER NOT NULL DEFAULT 3,
    "dueSoonWindowDays" INTEGER NOT NULL DEFAULT 7,
    "artifactRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "twoPersonApprovalForExport" BOOLEAN NOT NULL DEFAULT false,
    "requireJustification" BOOLEAN NOT NULL DEFAULT true,
    "requireConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_governance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "enabledByUserId" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledByUserId" TEXT,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redaction_suggestions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "evidenceItemId" TEXT,
    "elementType" TEXT NOT NULL,
    "originalSnippet" TEXT NOT NULL,
    "suggestedRedaction" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RedactionStatus" NOT NULL DEFAULT 'SUGGESTED',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redaction_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "break_glass_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" "BreakGlassEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "caseId" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "break_glass_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_approvals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exportArtifactId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_team_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_sla_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initialDeadlineDays" INTEGER NOT NULL DEFAULT 30,
    "extensionMaxDays" INTEGER NOT NULL DEFAULT 60,
    "useBusinessDays" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "yellowThresholdDays" INTEGER NOT NULL DEFAULT 14,
    "redThresholdDays" INTEGER NOT NULL DEFAULT 7,
    "milestoneIdvDays" INTEGER NOT NULL DEFAULT 7,
    "milestoneCollectionDays" INTEGER NOT NULL DEFAULT 14,
    "milestoneDraftDays" INTEGER NOT NULL DEFAULT 21,
    "milestoneLegalDays" INTEGER NOT NULL DEFAULT 25,
    "escalationYellowRoles" TEXT[] DEFAULT ARRAY['DPO', 'CASE_MANAGER']::TEXT[],
    "escalationRedRoles" TEXT[] DEFAULT ARRAY['TENANT_ADMIN', 'DPO']::TEXT[],
    "escalationOverdueRoles" TEXT[] DEFAULT ARRAY['TENANT_ADMIN', 'DPO']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_sla_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'DE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_deadlines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "legalDueAt" TIMESTAMP(3) NOT NULL,
    "extendedDueAt" TIMESTAMP(3),
    "effectiveDueAt" TIMESTAMP(3) NOT NULL,
    "extensionAppliedAt" TIMESTAMP(3),
    "extensionDays" INTEGER,
    "extensionReason" TEXT,
    "extensionNotificationRequired" BOOLEAN NOT NULL DEFAULT true,
    "extensionNotificationSentAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "pauseApprovedBy" TEXT,
    "totalPausedDays" INTEGER NOT NULL DEFAULT 0,
    "currentRisk" "RiskLevel" NOT NULL DEFAULT 'GREEN',
    "riskReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "daysRemaining" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" "DeadlineEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deadline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_milestones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "milestoneType" "MilestoneType" NOT NULL,
    "plannedDueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "severity" "EscalationSeverity" NOT NULL,
    "reason" TEXT NOT NULL,
    "recipientRoles" TEXT[],
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "emailPayload" JSONB,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idv_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "dataSubjectId" TEXT NOT NULL,
    "status" "IdvRequestStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "portalToken" TEXT,
    "portalTokenExp" TIMESTAMP(3),
    "allowedMethods" "IdvMethod"[],
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "maxSubmissions" INTEGER NOT NULL DEFAULT 3,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idv_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idv_artifacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "artifactType" "IdvArtifactType" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "retainUntil" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idv_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idv_checks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "method" "IdvMethod" NOT NULL,
    "passed" BOOLEAN,
    "details" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idv_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idv_decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "outcome" "IdvDecisionOutcome" NOT NULL,
    "rationale" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idv_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idv_risk_assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "flags" JSONB NOT NULL,
    "extractedFields" JSONB,
    "mismatches" JSONB,
    "rawOutput" JSONB,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idv_risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idv_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "allowedMethods" "IdvMethod"[] DEFAULT ARRAY['DOC_UPLOAD']::"IdvMethod"[],
    "selfieEnabled" BOOLEAN NOT NULL DEFAULT false,
    "knowledgeBasedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailOtpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "portalTokenExpiryDays" INTEGER NOT NULL DEFAULT 7,
    "maxSubmissionsPerToken" INTEGER NOT NULL DEFAULT 3,
    "bypassForSsoEmail" BOOLEAN NOT NULL DEFAULT false,
    "bypassForRepeatRequester" BOOLEAN NOT NULL DEFAULT false,
    "repeatRequesterMonths" INTEGER NOT NULL DEFAULT 6,
    "autoTransitionOnApproval" BOOLEAN NOT NULL DEFAULT false,
    "storeDob" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idv_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "jurisdiction" TEXT NOT NULL DEFAULT 'GDPR',
    "dsarTypes" "DSARType"[],
    "subjectTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sections" JSONB NOT NULL,
    "placeholders" JSONB,
    "conditionals" JSONB,
    "disclaimerText" TEXT,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "clonedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_template_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "changedBy" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "templateId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ResponseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "sections" JSONB NOT NULL,
    "fullHtml" TEXT NOT NULL,
    "factPackSnapshot" JSONB,
    "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "aiModelUsed" TEXT,
    "aiWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storageKeyPdf" TEXT,
    "storageKeyDocx" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "editedByUserId" TEXT,
    "editedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_approvals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "responseDocId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "responseDocId" TEXT NOT NULL,
    "method" "DeliveryMethod" NOT NULL,
    "recipientRef" TEXT,
    "proofStorageKey" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redaction_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "responseDocId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sectionKey" TEXT,
    "documentRef" TEXT,
    "redactedContent" TEXT,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redaction_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3),
    "containedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "regulatorNotificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "regulatorNotifiedAt" TIMESTAMP(3),
    "numberOfDataSubjectsEstimate" INTEGER,
    "categoriesOfDataAffected" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "crossBorder" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_sources" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "sourceType" "IncidentSourceType" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "systemName" TEXT,
    "importedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_systems" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_timelines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "eventType" "IncidentTimelineEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_communications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "documentRef" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "natureOfBreach" TEXT,
    "categoriesAndApproxSubjects" TEXT,
    "categoriesAndApproxRecords" TEXT,
    "likelyConsequences" TEXT,
    "measuresTakenOrProposed" TEXT,
    "dpoContactDetails" TEXT,
    "additionalNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_regulator_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorityName" TEXT NOT NULL,
    "country" TEXT,
    "referenceNumber" TEXT,
    "status" "RegulatorRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "documentRefs" JSONB,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_regulator_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_incidents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "linkReason" TEXT,
    "subjectInScope" "DsarIncidentSubjectStatus" NOT NULL DEFAULT 'UNKNOWN',
    "linkedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dsar_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surge_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "suggestedSystems" JSONB,
    "suggestedTemplate" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surge_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surge_group_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "surgeGroupId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surge_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authority_export_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "status" "AuthorityExportStatus" NOT NULL DEFAULT 'PENDING',
    "includeTimeline" BOOLEAN NOT NULL DEFAULT true,
    "includeDsarList" BOOLEAN NOT NULL DEFAULT true,
    "includeEvidence" BOOLEAN NOT NULL DEFAULT false,
    "includeResponses" BOOLEAN NOT NULL DEFAULT false,
    "pdfStorageKey" TEXT,
    "zipStorageKey" TEXT,
    "fileChecksum" TEXT,
    "fileSize" INTEGER,
    "errorMessage" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "authority_export_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "website" TEXT,
    "headquartersCountry" TEXT,
    "dpaOnFile" BOOLEAN NOT NULL DEFAULT false,
    "dpaExpiresAt" TIMESTAMP(3),
    "contractReference" TEXT,
    "notes" TEXT,
    "tags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_dpas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "storageKey" TEXT,
    "sccsIncluded" BOOLEAN NOT NULL DEFAULT false,
    "subprocessorListUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_dpas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_request_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "dsarTypes" "DSARType"[],
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "placeholders" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_request_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "systemId" TEXT,
    "status" "VendorRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_request_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "systemId" TEXT,
    "description" TEXT NOT NULL,
    "status" "VendorRequestItemStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_responses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "responseType" "VendorResponseType" NOT NULL DEFAULT 'DATA_EXTRACT',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_response_artifacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256Hash" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_response_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_sla_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "defaultDueDays" INTEGER NOT NULL DEFAULT 14,
    "reminderAfterDays" INTEGER NOT NULL DEFAULT 7,
    "escalationAfterDays" INTEGER NOT NULL DEFAULT 14,
    "maxReminders" INTEGER NOT NULL DEFAULT 3,
    "autoEscalate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_sla_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_escalations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "requestId" TEXT,
    "severity" "VendorEscalationSeverity" NOT NULL,
    "reason" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_kpi_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" "KpiSnapshotPeriod" NOT NULL DEFAULT 'MONTHLY',
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "totalDsars" INTEGER NOT NULL DEFAULT 0,
    "openDsars" INTEGER NOT NULL DEFAULT 0,
    "closedDsars" INTEGER NOT NULL DEFAULT 0,
    "avgTimeToCloseDays" DOUBLE PRECISION,
    "medianTimeToCloseDays" DOUBLE PRECISION,
    "extensionRatePct" DOUBLE PRECISION,
    "overdueRatePct" DOUBLE PRECISION,
    "dsarsByType" JSONB,
    "dsarsBySubjectType" JSONB,
    "dsarsLinkedToIncidentPct" DOUBLE PRECISION,
    "riskDistribution" JSONB,
    "highRiskCasesCount" INTEGER NOT NULL DEFAULT 0,
    "incidentLinkedHighRiskCount" INTEGER NOT NULL DEFAULT 0,
    "vendorOverdueCount" INTEGER NOT NULL DEFAULT 0,
    "autoSuggestedSystemsPct" DOUBLE PRECISION,
    "vendorAutoGeneratedPct" DOUBLE PRECISION,
    "templateResponsePct" DOUBLE PRECISION,
    "idvAutomationPct" DOUBLE PRECISION,
    "apiReadySystemsPct" DOUBLE PRECISION,
    "dpaOnFilePct" DOUBLE PRECISION,
    "systemsCompleteMetaPct" DOUBLE PRECISION,
    "retentionDefinedPct" DOUBLE PRECISION,
    "thirdCountryTransferRatio" DOUBLE PRECISION,
    "estimatedCostPerDsar" DOUBLE PRECISION,
    "estimatedTimeSavedPerDsar" DOUBLE PRECISION,
    "totalTimeSavedMonthly" DOUBLE PRECISION,
    "maturityScore" DOUBLE PRECISION,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_kpi_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "estimatedCostPerDsar" DOUBLE PRECISION NOT NULL DEFAULT 150.0,
    "estimatedMinutesManual" DOUBLE PRECISION NOT NULL DEFAULT 480.0,
    "estimatedMinutesAutomated" DOUBLE PRECISION NOT NULL DEFAULT 120.0,
    "maturityWeights" JSONB,
    "snapshotCron" TEXT NOT NULL DEFAULT '0 2 * * *',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_kpi_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_metrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "casesWithAutoSystems" INTEGER NOT NULL DEFAULT 0,
    "vendorRequestsTotal" INTEGER NOT NULL DEFAULT 0,
    "vendorRequestsAuto" INTEGER NOT NULL DEFAULT 0,
    "responsesTotal" INTEGER NOT NULL DEFAULT 0,
    "responsesViaTemplate" INTEGER NOT NULL DEFAULT 0,
    "idvRequestsTotal" INTEGER NOT NULL DEFAULT 0,
    "idvRequestsAutomated" INTEGER NOT NULL DEFAULT 0,
    "avgProcessingMinutes" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executive_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sections" JSONB,
    "schedule" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executive_report_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "format" "ReportFormat" NOT NULL DEFAULT 'PDF',
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "storageKey" TEXT,
    "fileSize" INTEGER,
    "fileChecksum" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "executive_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_thresholds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kpiKey" TEXT NOT NULL,
    "greenMax" DOUBLE PRECISION,
    "yellowMax" DOUBLE PRECISION,
    "direction" TEXT NOT NULL DEFAULT 'lower_is_better',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maturity_scores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" "MaturityDomain" NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maturity_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_export_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "format" "ReportFormat" NOT NULL DEFAULT 'PDF',
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "storageKey" TEXT,
    "fileSize" INTEGER,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "board_export_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_models" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "parameters" JSONB,
    "lastTrainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forecastData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecast_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "data_subjects_tenantId_idx" ON "data_subjects"("tenantId");

-- CreateIndex
CREATE INDEX "data_subjects_tenantId_email_idx" ON "data_subjects"("tenantId", "email");

-- CreateIndex
CREATE INDEX "dsar_cases_tenantId_idx" ON "dsar_cases"("tenantId");

-- CreateIndex
CREATE INDEX "dsar_cases_tenantId_status_idx" ON "dsar_cases"("tenantId", "status");

-- CreateIndex
CREATE INDEX "dsar_cases_tenantId_assignedToUserId_idx" ON "dsar_cases"("tenantId", "assignedToUserId");

-- CreateIndex
CREATE UNIQUE INDEX "dsar_cases_tenantId_caseNumber_key" ON "dsar_cases"("tenantId", "caseNumber");

-- CreateIndex
CREATE INDEX "dsar_state_transitions_tenantId_caseId_idx" ON "dsar_state_transitions"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_idx" ON "tasks"("tenantId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_caseId_idx" ON "tasks"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_assigneeUserId_idx" ON "tasks"("tenantId", "assigneeUserId");

-- CreateIndex
CREATE INDEX "documents_tenantId_idx" ON "documents"("tenantId");

-- CreateIndex
CREATE INDEX "documents_tenantId_caseId_idx" ON "documents"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "comments_tenantId_caseId_idx" ON "comments"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_actorUserId_idx" ON "audit_logs"("tenantId", "actorUserId");

-- CreateIndex
CREATE INDEX "systems_tenantId_idx" ON "systems"("tenantId");

-- CreateIndex
CREATE INDEX "system_data_categories_tenantId_idx" ON "system_data_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "system_data_categories_systemId_category_key" ON "system_data_categories"("systemId", "category");

-- CreateIndex
CREATE INDEX "system_processors_tenantId_idx" ON "system_processors"("tenantId");

-- CreateIndex
CREATE INDEX "system_processors_systemId_idx" ON "system_processors"("systemId");

-- CreateIndex
CREATE INDEX "system_processors_vendorId_idx" ON "system_processors"("vendorId");

-- CreateIndex
CREATE INDEX "discovery_rules_tenantId_idx" ON "discovery_rules"("tenantId");

-- CreateIndex
CREATE INDEX "discovery_rules_tenantId_active_idx" ON "discovery_rules"("tenantId", "active");

-- CreateIndex
CREATE INDEX "case_system_links_tenantId_idx" ON "case_system_links"("tenantId");

-- CreateIndex
CREATE INDEX "case_system_links_tenantId_caseId_idx" ON "case_system_links"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "case_system_links_caseId_systemId_key" ON "case_system_links"("caseId", "systemId");

-- CreateIndex
CREATE INDEX "communication_logs_tenantId_caseId_idx" ON "communication_logs"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "data_collection_items_tenantId_caseId_idx" ON "data_collection_items"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "legal_reviews_tenantId_caseId_idx" ON "legal_reviews"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "integrations_tenantId_idx" ON "integrations"("tenantId");

-- CreateIndex
CREATE INDEX "integrations_tenantId_status_idx" ON "integrations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "integration_secrets_integrationId_idx" ON "integration_secrets"("integrationId");

-- CreateIndex
CREATE INDEX "copilot_runs_tenantId_caseId_idx" ON "copilot_runs"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "copilot_runs_tenantId_status_idx" ON "copilot_runs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "copilot_queries_tenantId_runId_idx" ON "copilot_queries"("tenantId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_profiles_tenantId_caseId_key" ON "identity_profiles"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "evidence_items_tenantId_runId_idx" ON "evidence_items"("tenantId", "runId");

-- CreateIndex
CREATE INDEX "evidence_items_tenantId_caseId_idx" ON "evidence_items"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "detector_results_tenantId_evidenceItemId_idx" ON "detector_results"("tenantId", "evidenceItemId");

-- CreateIndex
CREATE INDEX "findings_tenantId_runId_idx" ON "findings"("tenantId", "runId");

-- CreateIndex
CREATE INDEX "findings_tenantId_caseId_idx" ON "findings"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "copilot_summaries_tenantId_runId_idx" ON "copilot_summaries"("tenantId", "runId");

-- CreateIndex
CREATE INDEX "export_artifacts_tenantId_runId_idx" ON "export_artifacts"("tenantId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "copilot_governance_settings_tenantId_key" ON "copilot_governance_settings"("tenantId");

-- CreateIndex
CREATE INDEX "legal_holds_tenantId_caseId_idx" ON "legal_holds"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "redaction_suggestions_tenantId_runId_idx" ON "redaction_suggestions"("tenantId", "runId");

-- CreateIndex
CREATE INDEX "redaction_suggestions_tenantId_caseId_idx" ON "redaction_suggestions"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "break_glass_events_tenantId_idx" ON "break_glass_events"("tenantId");

-- CreateIndex
CREATE INDEX "break_glass_events_tenantId_eventType_idx" ON "break_glass_events"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "export_approvals_tenantId_exportArtifactId_idx" ON "export_approvals"("tenantId", "exportArtifactId");

-- CreateIndex
CREATE INDEX "case_team_members_tenantId_caseId_idx" ON "case_team_members"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "case_team_members_tenantId_userId_idx" ON "case_team_members"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "case_team_members_tenantId_caseId_userId_key" ON "case_team_members"("tenantId", "caseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sla_configs_tenantId_key" ON "tenant_sla_configs"("tenantId");

-- CreateIndex
CREATE INDEX "holidays_tenantId_idx" ON "holidays"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_tenantId_date_key" ON "holidays"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "case_deadlines_caseId_key" ON "case_deadlines"("caseId");

-- CreateIndex
CREATE INDEX "case_deadlines_tenantId_idx" ON "case_deadlines"("tenantId");

-- CreateIndex
CREATE INDEX "case_deadlines_tenantId_currentRisk_idx" ON "case_deadlines"("tenantId", "currentRisk");

-- CreateIndex
CREATE INDEX "case_deadlines_tenantId_effectiveDueAt_idx" ON "case_deadlines"("tenantId", "effectiveDueAt");

-- CreateIndex
CREATE INDEX "deadline_events_tenantId_caseId_idx" ON "deadline_events"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "case_milestones_tenantId_caseId_idx" ON "case_milestones"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "case_milestones_tenantId_caseId_milestoneType_key" ON "case_milestones"("tenantId", "caseId", "milestoneType");

-- CreateIndex
CREATE INDEX "escalations_tenantId_caseId_idx" ON "escalations"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "escalations_tenantId_severity_idx" ON "escalations"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "notifications_tenantId_recipientUserId_read_idx" ON "notifications"("tenantId", "recipientUserId", "read");

-- CreateIndex
CREATE INDEX "notifications_tenantId_recipientUserId_createdAt_idx" ON "notifications"("tenantId", "recipientUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "idv_requests_caseId_key" ON "idv_requests"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "idv_requests_portalToken_key" ON "idv_requests"("portalToken");

-- CreateIndex
CREATE INDEX "idv_requests_tenantId_caseId_idx" ON "idv_requests"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "idv_requests_portalToken_idx" ON "idv_requests"("portalToken");

-- CreateIndex
CREATE INDEX "idv_artifacts_tenantId_requestId_idx" ON "idv_artifacts"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "idv_artifacts_retainUntil_idx" ON "idv_artifacts"("retainUntil");

-- CreateIndex
CREATE INDEX "idv_checks_tenantId_requestId_idx" ON "idv_checks"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "idv_decisions_tenantId_requestId_idx" ON "idv_decisions"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "idv_risk_assessments_tenantId_requestId_idx" ON "idv_risk_assessments"("tenantId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "idv_settings_tenantId_key" ON "idv_settings"("tenantId");

-- CreateIndex
CREATE INDEX "response_templates_tenantId_idx" ON "response_templates"("tenantId");

-- CreateIndex
CREATE INDEX "response_templates_tenantId_language_idx" ON "response_templates"("tenantId", "language");

-- CreateIndex
CREATE INDEX "response_template_versions_templateId_idx" ON "response_template_versions"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "response_template_versions_templateId_version_key" ON "response_template_versions"("templateId", "version");

-- CreateIndex
CREATE INDEX "response_documents_tenantId_caseId_idx" ON "response_documents"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "response_documents_tenantId_status_idx" ON "response_documents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "response_approvals_tenantId_responseDocId_idx" ON "response_approvals"("tenantId", "responseDocId");

-- CreateIndex
CREATE INDEX "delivery_records_tenantId_responseDocId_idx" ON "delivery_records"("tenantId", "responseDocId");

-- CreateIndex
CREATE INDEX "redaction_entries_tenantId_responseDocId_idx" ON "redaction_entries"("tenantId", "responseDocId");

-- CreateIndex
CREATE INDEX "redaction_entries_tenantId_caseId_idx" ON "redaction_entries"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "incidents_tenantId_idx" ON "incidents"("tenantId");

-- CreateIndex
CREATE INDEX "incidents_tenantId_status_idx" ON "incidents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "incidents_tenantId_severity_idx" ON "incidents"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "incident_sources_tenantId_incidentId_idx" ON "incident_sources"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "incident_systems_tenantId_incidentId_idx" ON "incident_systems"("tenantId", "incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_systems_incidentId_systemId_key" ON "incident_systems"("incidentId", "systemId");

-- CreateIndex
CREATE INDEX "incident_contacts_tenantId_incidentId_idx" ON "incident_contacts"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "incident_timelines_tenantId_incidentId_idx" ON "incident_timelines"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "incident_communications_tenantId_incidentId_idx" ON "incident_communications"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "incident_assessments_tenantId_incidentId_idx" ON "incident_assessments"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "incident_regulator_records_tenantId_incidentId_idx" ON "incident_regulator_records"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "dsar_incidents_tenantId_caseId_idx" ON "dsar_incidents"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "dsar_incidents_tenantId_incidentId_idx" ON "dsar_incidents"("tenantId", "incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "dsar_incidents_caseId_incidentId_key" ON "dsar_incidents"("caseId", "incidentId");

-- CreateIndex
CREATE INDEX "surge_groups_tenantId_incidentId_idx" ON "surge_groups"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "surge_group_members_tenantId_surgeGroupId_idx" ON "surge_group_members"("tenantId", "surgeGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "surge_group_members_surgeGroupId_caseId_key" ON "surge_group_members"("surgeGroupId", "caseId");

-- CreateIndex
CREATE INDEX "authority_export_runs_tenantId_incidentId_idx" ON "authority_export_runs"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_idx" ON "vendors"("tenantId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_status_idx" ON "vendors"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tenantId_name_key" ON "vendors"("tenantId", "name");

-- CreateIndex
CREATE INDEX "vendor_contacts_tenantId_vendorId_idx" ON "vendor_contacts"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "vendor_dpas_tenantId_vendorId_idx" ON "vendor_dpas"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "vendor_request_templates_tenantId_idx" ON "vendor_request_templates"("tenantId");

-- CreateIndex
CREATE INDEX "vendor_request_templates_tenantId_vendorId_idx" ON "vendor_request_templates"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "vendor_requests_tenantId_caseId_idx" ON "vendor_requests"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "vendor_requests_tenantId_vendorId_idx" ON "vendor_requests"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "vendor_requests_tenantId_status_idx" ON "vendor_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "vendor_request_items_tenantId_requestId_idx" ON "vendor_request_items"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "vendor_responses_tenantId_requestId_idx" ON "vendor_responses"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "vendor_response_artifacts_tenantId_responseId_idx" ON "vendor_response_artifacts"("tenantId", "responseId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_sla_configs_vendorId_key" ON "vendor_sla_configs"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_sla_configs_tenantId_idx" ON "vendor_sla_configs"("tenantId");

-- CreateIndex
CREATE INDEX "vendor_escalations_tenantId_vendorId_idx" ON "vendor_escalations"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "vendor_escalations_tenantId_severity_idx" ON "vendor_escalations"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "privacy_kpi_snapshots_tenantId_period_idx" ON "privacy_kpi_snapshots"("tenantId", "period");

-- CreateIndex
CREATE INDEX "privacy_kpi_snapshots_tenantId_snapshotDate_idx" ON "privacy_kpi_snapshots"("tenantId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_kpi_snapshots_tenantId_period_snapshotDate_key" ON "privacy_kpi_snapshots"("tenantId", "period", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_kpi_configs_tenantId_key" ON "privacy_kpi_configs"("tenantId");

-- CreateIndex
CREATE INDEX "automation_metrics_tenantId_idx" ON "automation_metrics"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "automation_metrics_tenantId_month_key" ON "automation_metrics"("tenantId", "month");

-- CreateIndex
CREATE INDEX "executive_reports_tenantId_idx" ON "executive_reports"("tenantId");

-- CreateIndex
CREATE INDEX "executive_report_runs_tenantId_reportId_idx" ON "executive_report_runs"("tenantId", "reportId");

-- CreateIndex
CREATE INDEX "kpi_thresholds_tenantId_idx" ON "kpi_thresholds"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_thresholds_tenantId_kpiKey_key" ON "kpi_thresholds"("tenantId", "kpiKey");

-- CreateIndex
CREATE INDEX "maturity_scores_tenantId_month_idx" ON "maturity_scores"("tenantId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "maturity_scores_tenantId_domain_month_key" ON "maturity_scores"("tenantId", "domain", "month");

-- CreateIndex
CREATE INDEX "board_export_runs_tenantId_idx" ON "board_export_runs"("tenantId");

-- CreateIndex
CREATE INDEX "forecast_models_tenantId_idx" ON "forecast_models"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_models_tenantId_modelType_key" ON "forecast_models"("tenantId", "modelType");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subjects" ADD CONSTRAINT "data_subjects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_cases" ADD CONSTRAINT "dsar_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_cases" ADD CONSTRAINT "dsar_cases_dataSubjectId_fkey" FOREIGN KEY ("dataSubjectId") REFERENCES "data_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_cases" ADD CONSTRAINT "dsar_cases_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_cases" ADD CONSTRAINT "dsar_cases_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_state_transitions" ADD CONSTRAINT "dsar_state_transitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_state_transitions" ADD CONSTRAINT "dsar_state_transitions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_state_transitions" ADD CONSTRAINT "dsar_state_transitions_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "systems" ADD CONSTRAINT "systems_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "systems" ADD CONSTRAINT "systems_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_data_categories" ADD CONSTRAINT "system_data_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_data_categories" ADD CONSTRAINT "system_data_categories_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_processors" ADD CONSTRAINT "system_processors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_processors" ADD CONSTRAINT "system_processors_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_processors" ADD CONSTRAINT "system_processors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_rules" ADD CONSTRAINT "discovery_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_rules" ADD CONSTRAINT "discovery_rules_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_system_links" ADD CONSTRAINT "case_system_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_system_links" ADD CONSTRAINT "case_system_links_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_system_links" ADD CONSTRAINT "case_system_links_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_items" ADD CONSTRAINT "data_collection_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_items" ADD CONSTRAINT "data_collection_items_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_items" ADD CONSTRAINT "data_collection_items_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_items" ADD CONSTRAINT "data_collection_items_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_collection_items" ADD CONSTRAINT "data_collection_items_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_secrets" ADD CONSTRAINT "integration_secrets_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_runs" ADD CONSTRAINT "copilot_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_runs" ADD CONSTRAINT "copilot_runs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_runs" ADD CONSTRAINT "copilot_runs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_runs" ADD CONSTRAINT "copilot_runs_legalApprovedByUserId_fkey" FOREIGN KEY ("legalApprovedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_queries" ADD CONSTRAINT "copilot_queries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_queries" ADD CONSTRAINT "copilot_queries_runId_fkey" FOREIGN KEY ("runId") REFERENCES "copilot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_queries" ADD CONSTRAINT "copilot_queries_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_queries" ADD CONSTRAINT "copilot_queries_subjectIdentityId_fkey" FOREIGN KEY ("subjectIdentityId") REFERENCES "identity_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_runId_fkey" FOREIGN KEY ("runId") REFERENCES "copilot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "copilot_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detector_results" ADD CONSTRAINT "detector_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detector_results" ADD CONSTRAINT "detector_results_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "evidence_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_runId_fkey" FOREIGN KEY ("runId") REFERENCES "copilot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_summaries" ADD CONSTRAINT "copilot_summaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_summaries" ADD CONSTRAINT "copilot_summaries_runId_fkey" FOREIGN KEY ("runId") REFERENCES "copilot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_summaries" ADD CONSTRAINT "copilot_summaries_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "copilot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_governance_settings" ADD CONSTRAINT "copilot_governance_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_enabledByUserId_fkey" FOREIGN KEY ("enabledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_disabledByUserId_fkey" FOREIGN KEY ("disabledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redaction_suggestions" ADD CONSTRAINT "redaction_suggestions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redaction_suggestions" ADD CONSTRAINT "redaction_suggestions_runId_fkey" FOREIGN KEY ("runId") REFERENCES "copilot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redaction_suggestions" ADD CONSTRAINT "redaction_suggestions_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_events" ADD CONSTRAINT "break_glass_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_events" ADD CONSTRAINT "break_glass_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_events" ADD CONSTRAINT "break_glass_events_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_approvals" ADD CONSTRAINT "export_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_approvals" ADD CONSTRAINT "export_approvals_exportArtifactId_fkey" FOREIGN KEY ("exportArtifactId") REFERENCES "export_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_approvals" ADD CONSTRAINT "export_approvals_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team_members" ADD CONSTRAINT "case_team_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team_members" ADD CONSTRAINT "case_team_members_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team_members" ADD CONSTRAINT "case_team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_sla_configs" ADD CONSTRAINT "tenant_sla_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_deadlines" ADD CONSTRAINT "case_deadlines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_deadlines" ADD CONSTRAINT "case_deadlines_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_events" ADD CONSTRAINT "deadline_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_events" ADD CONSTRAINT "deadline_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_events" ADD CONSTRAINT "deadline_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_milestones" ADD CONSTRAINT "case_milestones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_milestones" ADD CONSTRAINT "case_milestones_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_requests" ADD CONSTRAINT "idv_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_requests" ADD CONSTRAINT "idv_requests_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_artifacts" ADD CONSTRAINT "idv_artifacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_artifacts" ADD CONSTRAINT "idv_artifacts_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "idv_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_checks" ADD CONSTRAINT "idv_checks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_checks" ADD CONSTRAINT "idv_checks_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "idv_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_decisions" ADD CONSTRAINT "idv_decisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_decisions" ADD CONSTRAINT "idv_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "idv_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_decisions" ADD CONSTRAINT "idv_decisions_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_risk_assessments" ADD CONSTRAINT "idv_risk_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_risk_assessments" ADD CONSTRAINT "idv_risk_assessments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "idv_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idv_settings" ADD CONSTRAINT "idv_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "response_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_template_versions" ADD CONSTRAINT "response_template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "response_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_documents" ADD CONSTRAINT "response_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_documents" ADD CONSTRAINT "response_documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_documents" ADD CONSTRAINT "response_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "response_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_documents" ADD CONSTRAINT "response_documents_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_documents" ADD CONSTRAINT "response_documents_editedByUserId_fkey" FOREIGN KEY ("editedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_documents" ADD CONSTRAINT "response_documents_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_approvals" ADD CONSTRAINT "response_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_approvals" ADD CONSTRAINT "response_approvals_responseDocId_fkey" FOREIGN KEY ("responseDocId") REFERENCES "response_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_approvals" ADD CONSTRAINT "response_approvals_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_responseDocId_fkey" FOREIGN KEY ("responseDocId") REFERENCES "response_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redaction_entries" ADD CONSTRAINT "redaction_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redaction_entries" ADD CONSTRAINT "redaction_entries_responseDocId_fkey" FOREIGN KEY ("responseDocId") REFERENCES "response_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redaction_entries" ADD CONSTRAINT "redaction_entries_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_sources" ADD CONSTRAINT "incident_sources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_sources" ADD CONSTRAINT "incident_sources_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_systems" ADD CONSTRAINT "incident_systems_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_systems" ADD CONSTRAINT "incident_systems_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_systems" ADD CONSTRAINT "incident_systems_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_contacts" ADD CONSTRAINT "incident_contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_contacts" ADD CONSTRAINT "incident_contacts_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timelines" ADD CONSTRAINT "incident_timelines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timelines" ADD CONSTRAINT "incident_timelines_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timelines" ADD CONSTRAINT "incident_timelines_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_communications" ADD CONSTRAINT "incident_communications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_communications" ADD CONSTRAINT "incident_communications_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_communications" ADD CONSTRAINT "incident_communications_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_assessments" ADD CONSTRAINT "incident_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_assessments" ADD CONSTRAINT "incident_assessments_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_assessments" ADD CONSTRAINT "incident_assessments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_regulator_records" ADD CONSTRAINT "incident_regulator_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_regulator_records" ADD CONSTRAINT "incident_regulator_records_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_incidents" ADD CONSTRAINT "dsar_incidents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_incidents" ADD CONSTRAINT "dsar_incidents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_incidents" ADD CONSTRAINT "dsar_incidents_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_incidents" ADD CONSTRAINT "dsar_incidents_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surge_groups" ADD CONSTRAINT "surge_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surge_groups" ADD CONSTRAINT "surge_groups_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surge_groups" ADD CONSTRAINT "surge_groups_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surge_group_members" ADD CONSTRAINT "surge_group_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surge_group_members" ADD CONSTRAINT "surge_group_members_surgeGroupId_fkey" FOREIGN KEY ("surgeGroupId") REFERENCES "surge_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surge_group_members" ADD CONSTRAINT "surge_group_members_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authority_export_runs" ADD CONSTRAINT "authority_export_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authority_export_runs" ADD CONSTRAINT "authority_export_runs_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authority_export_runs" ADD CONSTRAINT "authority_export_runs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_dpas" ADD CONSTRAINT "vendor_dpas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_dpas" ADD CONSTRAINT "vendor_dpas_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_request_templates" ADD CONSTRAINT "vendor_request_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_request_templates" ADD CONSTRAINT "vendor_request_templates_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_requests" ADD CONSTRAINT "vendor_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_requests" ADD CONSTRAINT "vendor_requests_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "dsar_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_requests" ADD CONSTRAINT "vendor_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_requests" ADD CONSTRAINT "vendor_requests_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_requests" ADD CONSTRAINT "vendor_requests_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_request_items" ADD CONSTRAINT "vendor_request_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_request_items" ADD CONSTRAINT "vendor_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "vendor_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_request_items" ADD CONSTRAINT "vendor_request_items_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_responses" ADD CONSTRAINT "vendor_responses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_responses" ADD CONSTRAINT "vendor_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "vendor_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_responses" ADD CONSTRAINT "vendor_responses_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_response_artifacts" ADD CONSTRAINT "vendor_response_artifacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_response_artifacts" ADD CONSTRAINT "vendor_response_artifacts_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "vendor_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_sla_configs" ADD CONSTRAINT "vendor_sla_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_sla_configs" ADD CONSTRAINT "vendor_sla_configs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_escalations" ADD CONSTRAINT "vendor_escalations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_escalations" ADD CONSTRAINT "vendor_escalations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_escalations" ADD CONSTRAINT "vendor_escalations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_kpi_snapshots" ADD CONSTRAINT "privacy_kpi_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_kpi_configs" ADD CONSTRAINT "privacy_kpi_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_metrics" ADD CONSTRAINT "automation_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_reports" ADD CONSTRAINT "executive_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_report_runs" ADD CONSTRAINT "executive_report_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_report_runs" ADD CONSTRAINT "executive_report_runs_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "executive_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executive_report_runs" ADD CONSTRAINT "executive_report_runs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_thresholds" ADD CONSTRAINT "kpi_thresholds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maturity_scores" ADD CONSTRAINT "maturity_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_export_runs" ADD CONSTRAINT "board_export_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_export_runs" ADD CONSTRAINT "board_export_runs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_models" ADD CONSTRAINT "forecast_models_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ═══════════════════════════════════════════════════════════════
-- SEED DATA: Tenant + Admin Users
-- ═══════════════════════════════════════════════════════════════

-- Create tenant
INSERT INTO "tenants" ("id", "name", "slaDefaultDays", "dueSoonDays", "retentionDays", "createdAt", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Acme Corp', 30, 7, 365, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Create admin user (admin@acme-corp.com / admin123)
INSERT INTO "users" ("id", "tenantId", "email", "name", "passwordHash", "role", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  'admin@acme-corp.com',
  'Admin',
  '$2a$12$VE7gCblp06ZRWhhtqlh6o.yqHDxU176kZNDW.ROzc.AWO7dEwRUpG',
  'TENANT_ADMIN',
  NOW(), NOW()
) ON CONFLICT DO NOTHING;

-- Create Daniel user (daniel.schormann@gmail.com / admin123)
INSERT INTO "users" ("id", "tenantId", "email", "name", "passwordHash", "role", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  'daniel.schormann@gmail.com',
  'Daniel Schormann',
  '$2a$12$VE7gCblp06ZRWhhtqlh6o.yqHDxU176kZNDW.ROzc.AWO7dEwRUpG',
  'TENANT_ADMIN',
  NOW(), NOW()
) ON CONFLICT DO NOTHING;
