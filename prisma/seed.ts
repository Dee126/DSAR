import { PrismaClient, UserRole, DSARType, CaseStatus, CasePriority, TaskStatus, CopilotRunStatus, CopilotQueryStatus, LegalApprovalStatus, QueryIntent, EvidenceItemType, ContentHandling, PrimaryIdentifierType, CopilotSummaryType, ExportType, ExportLegalGateStatus, FindingSeverity, FindingStatus, DataCategory, SystemCriticality, SystemStatus, AutomationReadiness, ConnectorType, LawfulBasis, ProcessorRole, RiskLevel, EscalationSeverity, DeadlineEventType, MilestoneType, NotificationType, IdvRequestStatus, IdvMethod, IdvArtifactType, IdvDecisionOutcome, ResponseDocStatus, DeliveryMethod, IncidentSeverity, IncidentStatus, IncidentTimelineEventType, RegulatorRecordStatus, IncidentSourceType, DsarIncidentSubjectStatus, VendorStatus, VendorRequestStatus, VendorResponseType, VendorEscalationSeverity, KpiSnapshotPeriod, MaturityDomain, ScanJobStatus, CaseItemDecision } from "@prisma/client";
import { hash } from "bcryptjs";

// ── Deterministic PRNG (mulberry32) ─────────────────────────────────────────
// Use SEED env var for reproducible demos: SEED=42 npm run db:seed
const SEED = parseInt(process.env.SEED || "42", 10);

function mulberry32(seed: number) {
  let s = seed | 0;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);
/** Deterministic random int in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
/** Pick a random element from an array */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
/** Shuffle array in place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data (order matters for FK constraints)
  // Discovery & Scan models
  await prisma.scanJob.deleteMany();
  await prisma.dataAsset.deleteMany();
  await prisma.dsarAuditEvent.deleteMany();
  await prisma.dsarCaseItem.deleteMany();
  // Module 7: Executive KPI
  await prisma.forecastModel.deleteMany();
  await prisma.boardExportRun.deleteMany();
  await prisma.maturityScore.deleteMany();
  await prisma.kpiThreshold.deleteMany();
  await prisma.executiveReportRun.deleteMany();
  await prisma.executiveReport.deleteMany();
  await prisma.automationMetric.deleteMany();
  await prisma.privacyKpiConfig.deleteMany();
  await prisma.privacyKpiSnapshot.deleteMany();
  // Module 6: Vendor
  await prisma.vendorEscalation.deleteMany();
  await prisma.vendorSlaConfig.deleteMany();
  await prisma.vendorResponseArtifact.deleteMany();
  await prisma.vendorResponse.deleteMany();
  await prisma.vendorRequestItem.deleteMany();
  await prisma.vendorRequest.deleteMany();
  await prisma.vendorRequestTemplate.deleteMany();
  await prisma.vendorDpa.deleteMany();
  await prisma.vendorContact.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.surgeGroupMember.deleteMany();
  await prisma.surgeGroup.deleteMany();
  await prisma.dsarIncident.deleteMany();
  await prisma.incidentCommunication.deleteMany();
  await prisma.incidentAssessment.deleteMany();
  await prisma.incidentRegulatorRecord.deleteMany();
  await prisma.incidentTimeline.deleteMany();
  await prisma.incidentContact.deleteMany();
  await prisma.incidentSystem.deleteMany();
  await prisma.incidentSource.deleteMany();
  await prisma.authorityExportRun.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.redactionEntry.deleteMany();
  await prisma.deliveryRecord.deleteMany();
  await prisma.responseApproval.deleteMany();
  await prisma.responseDocument.deleteMany();
  await prisma.responseTemplateVersion.deleteMany();
  await prisma.responseTemplate.deleteMany();
  await prisma.idvRiskAssessment.deleteMany();
  await prisma.idvDecision.deleteMany();
  await prisma.idvCheck.deleteMany();
  await prisma.idvArtifact.deleteMany();
  await prisma.idvRequest.deleteMany();
  await prisma.idvSettings.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.caseMilestone.deleteMany();
  await prisma.deadlineEvent.deleteMany();
  await prisma.caseDeadline.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.tenantSlaConfig.deleteMany();
  await prisma.caseSystemLink.deleteMany();
  await prisma.discoveryRule.deleteMany();
  await prisma.systemProcessor.deleteMany();
  await prisma.systemDataCategory.deleteMany();
  await prisma.exportArtifact.deleteMany();
  await prisma.copilotSummary.deleteMany();
  await prisma.detectorResult.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.evidenceItem.deleteMany();
  await prisma.copilotQuery.deleteMany();
  await prisma.copilotRun.deleteMany();
  await prisma.identityProfile.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.legalReview.deleteMany();
  await prisma.dataCollectionItem.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.communicationLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.task.deleteMany();
  await prisma.dSARStateTransition.deleteMany();
  await prisma.dSARCase.deleteMany();
  await prisma.dataSubject.deleteMany();
  await prisma.system.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: "Acme Corp",
      slaDefaultDays: 30,
      dueSoonDays: 7,
      retentionDays: 365,
    },
  });
  console.log(`Created tenant: ${tenant.name} (${tenant.id})`);

  // Create users
  const passwordHash = await hash("admin123456", 12);
  const danielPasswordHash = await hash("admin123", 12);

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "admin@acme-corp.com",
      name: "Alice Admin",
      passwordHash,
      role: UserRole.TENANT_ADMIN,
    },
  });

  const dpo = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "dpo@acme-corp.com",
      name: "David DPO",
      passwordHash,
      role: UserRole.DPO,
    },
  });

  const caseManager = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "manager@acme-corp.com",
      name: "Maria Manager",
      passwordHash,
      role: UserRole.CASE_MANAGER,
    },
  });

  const contributor = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "contributor@acme-corp.com",
      name: "Charlie Contributor",
      passwordHash,
      role: UserRole.CONTRIBUTOR,
    },
  });

  const readOnly = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "viewer@acme-corp.com",
      name: "Vera Viewer",
      passwordHash,
      role: UserRole.READ_ONLY,
    },
  });

  const daniel = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "daniel.schormann@gmail.com",
      name: "Daniel Schormann",
      passwordHash: danielPasswordHash,
      role: UserRole.TENANT_ADMIN,
    },
  });

  console.log("Created 6 users");

  // Create systems (Data Inventory — 10 realistic systems)
  const crmSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "CRM System", description: "Customer relationship management - Salesforce",
      owner: "Sales Department", contactEmail: "crm-admin@acme-corp.com", tags: ["customer-data", "salesforce"],
      ownerUserId: admin.id, criticality: SystemCriticality.HIGH, systemStatus: SystemStatus.ACTIVE,
      containsSpecialCategories: false, inScopeForDsar: true,
      automationReadiness: AutomationReadiness.API_AVAILABLE, connectorType: ConnectorType.SALESFORCE,
      exportFormats: ["csv", "json"], estimatedCollectionTimeMinutes: 15,
      dataResidencyPrimary: "EU", processingRegions: ["EU", "US-East"],
      identifierTypes: ["email", "phone", "customerId"],
    },
  });

  const hrSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "HR Platform", description: "Employee data management - Workday",
      owner: "Human Resources", contactEmail: "hr-admin@acme-corp.com", tags: ["employee-data", "workday"],
      ownerUserId: dpo.id, criticality: SystemCriticality.HIGH, systemStatus: SystemStatus.ACTIVE,
      containsSpecialCategories: true, inScopeForDsar: true,
      automationReadiness: AutomationReadiness.SEMI_AUTOMATED, connectorType: ConnectorType.NONE,
      exportFormats: ["csv", "pdf"], estimatedCollectionTimeMinutes: 60,
      dataResidencyPrimary: "EU", processingRegions: ["EU"],
      identifierTypes: ["email", "employeeId"],
    },
  });

  const analyticsSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "Analytics Platform", description: "User behavior analytics - Mixpanel",
      owner: "Product Team", contactEmail: "analytics@acme-corp.com", tags: ["analytics", "behavioral-data"],
      criticality: SystemCriticality.MEDIUM, systemStatus: SystemStatus.ACTIVE,
      containsSpecialCategories: false, inScopeForDsar: true,
      automationReadiness: AutomationReadiness.API_AVAILABLE, connectorType: ConnectorType.CUSTOM,
      exportFormats: ["json", "csv"], estimatedCollectionTimeMinutes: 10,
      dataResidencyPrimary: "US", processingRegions: ["US", "EU"],
      identifierTypes: ["email", "customerId"],
    },
  });

  const emailSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "Email Marketing", description: "Email marketing platform - Mailchimp",
      owner: "Marketing Team", contactEmail: "marketing@acme-corp.com", tags: ["marketing", "email", "consent"],
      criticality: SystemCriticality.MEDIUM, systemStatus: SystemStatus.ACTIVE,
      inScopeForDsar: true,
      automationReadiness: AutomationReadiness.API_AVAILABLE, connectorType: ConnectorType.CUSTOM,
      exportFormats: ["csv"], estimatedCollectionTimeMinutes: 5,
      dataResidencyPrimary: "US", processingRegions: ["US"],
      identifierTypes: ["email"],
    },
  });

  const m365System = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "Microsoft 365", description: "Email, files, collaboration - Exchange, SharePoint, OneDrive, Teams",
      owner: "IT Department", contactEmail: "it-admin@acme-corp.com", tags: ["m365", "email", "files"],
      ownerUserId: admin.id, criticality: SystemCriticality.HIGH, systemStatus: SystemStatus.ACTIVE,
      containsSpecialCategories: false, inScopeForDsar: true,
      automationReadiness: AutomationReadiness.API_AVAILABLE, connectorType: ConnectorType.M365,
      exportFormats: ["json", "csv", "pdf"], estimatedCollectionTimeMinutes: 30,
      dataResidencyPrimary: "EU", processingRegions: ["EU"],
      identifierTypes: ["email", "employeeId"],
    },
  });

  const financeSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "Finance (SAP)", description: "Financial ERP - SAP S/4HANA",
      owner: "Finance Department", contactEmail: "finance-admin@acme-corp.com", tags: ["finance", "sap", "billing"],
      criticality: SystemCriticality.HIGH, systemStatus: SystemStatus.ACTIVE,
      containsSpecialCategories: false, inScopeForDsar: true,
      automationReadiness: AutomationReadiness.MANUAL, connectorType: ConnectorType.NONE,
      exportFormats: ["csv", "pdf"], estimatedCollectionTimeMinutes: 120,
      dataResidencyPrimary: "EU", processingRegions: ["EU"],
      identifierTypes: ["email", "customerId"],
    },
  });

  const supportSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "Support (Zendesk)", description: "Customer support ticketing - Zendesk",
      owner: "Support Team", contactEmail: "support-admin@acme-corp.com", tags: ["support", "zendesk", "tickets"],
      criticality: SystemCriticality.MEDIUM, systemStatus: SystemStatus.ACTIVE,
      inScopeForDsar: true,
      automationReadiness: AutomationReadiness.API_AVAILABLE, connectorType: ConnectorType.CUSTOM,
      exportFormats: ["json", "csv"], estimatedCollectionTimeMinutes: 10,
      dataResidencyPrimary: "US", processingRegions: ["US", "EU"],
      identifierTypes: ["email", "phone"],
    },
  });

  const iamSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "IAM (Okta)", description: "Identity and access management - Okta",
      owner: "IT Security", contactEmail: "iam-admin@acme-corp.com", tags: ["iam", "okta", "identity"],
      ownerUserId: admin.id, criticality: SystemCriticality.HIGH, systemStatus: SystemStatus.ACTIVE,
      inScopeForDsar: true,
      automationReadiness: AutomationReadiness.API_AVAILABLE, connectorType: ConnectorType.CUSTOM,
      exportFormats: ["json"], estimatedCollectionTimeMinutes: 5,
      dataResidencyPrimary: "US", processingRegions: ["US", "EU"],
      identifierTypes: ["email", "employeeId"],
    },
  });

  const marketingSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "Marketing (HubSpot)", description: "Marketing automation and CRM - HubSpot",
      owner: "Marketing Team", contactEmail: "hubspot-admin@acme-corp.com", tags: ["marketing", "hubspot"],
      criticality: SystemCriticality.MEDIUM, systemStatus: SystemStatus.ACTIVE,
      inScopeForDsar: true,
      automationReadiness: AutomationReadiness.API_AVAILABLE, connectorType: ConnectorType.CUSTOM,
      exportFormats: ["csv", "json"], estimatedCollectionTimeMinutes: 10,
      dataResidencyPrimary: "EU", processingRegions: ["EU", "US"],
      identifierTypes: ["email", "phone", "customerId"],
    },
  });

  const fileShareSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "File Share (Legacy)", description: "Legacy on-premises file server",
      owner: "IT Department", contactEmail: "it-admin@acme-corp.com", tags: ["legacy", "files"],
      criticality: SystemCriticality.LOW, systemStatus: SystemStatus.RETIRED,
      inScopeForDsar: false,
      automationReadiness: AutomationReadiness.MANUAL, connectorType: ConnectorType.NONE,
      dataResidencyPrimary: "EU", processingRegions: ["EU"],
      identifierTypes: ["employeeId"],
    },
  });

  // ── Additional discovery systems ──────────────────────────────────────
  const exchangeSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "Exchange Online", description: "Email and calendar - Exchange Online mailboxes",
      owner: "IT Department", contactEmail: "exchange-admin@acme-corp.com", tags: ["exchange", "email", "mailbox"],
      ownerUserId: admin.id, criticality: SystemCriticality.HIGH, systemStatus: SystemStatus.ACTIVE,
      containsSpecialCategories: false, inScopeForDsar: true,
      automationReadiness: AutomationReadiness.API_AVAILABLE, connectorType: ConnectorType.M365,
      exportFormats: ["pst", "json", "csv"], estimatedCollectionTimeMinutes: 45,
      dataResidencyPrimary: "EU", processingRegions: ["EU"],
      identifierTypes: ["email", "employeeId"],
    },
  });

  const sharepointSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id, name: "SharePoint Online", description: "Document libraries and team sites - SharePoint Online",
      owner: "IT Department", contactEmail: "sharepoint-admin@acme-corp.com", tags: ["sharepoint", "documents", "sites"],
      ownerUserId: admin.id, criticality: SystemCriticality.HIGH, systemStatus: SystemStatus.ACTIVE,
      containsSpecialCategories: true, inScopeForDsar: true,
      automationReadiness: AutomationReadiness.API_AVAILABLE, connectorType: ConnectorType.M365,
      exportFormats: ["json", "csv", "pdf"], estimatedCollectionTimeMinutes: 60,
      dataResidencyPrimary: "EU", processingRegions: ["EU"],
      identifierTypes: ["email", "employeeId"],
    },
  });

  console.log("Created 12 systems");

  // ── System Data Categories ────────────────────────────────────────────
  await prisma.systemDataCategory.createMany({
    data: [
      // CRM
      { tenantId: tenant.id, systemId: crmSystem.id, category: "IDENTIFICATION", processingPurpose: "Customer identification and account management", lawfulBasis: LawfulBasis.CONTRACT, retentionPeriod: "Duration of contract + 3 years", retentionDays: 1095 },
      { tenantId: tenant.id, systemId: crmSystem.id, category: "CONTACT", processingPurpose: "Customer communication", lawfulBasis: LawfulBasis.CONTRACT },
      { tenantId: tenant.id, systemId: crmSystem.id, category: "CONTRACT", processingPurpose: "Contract management", lawfulBasis: LawfulBasis.CONTRACT, retentionPeriod: "7 years", retentionDays: 2555 },
      { tenantId: tenant.id, systemId: crmSystem.id, category: "COMMUNICATION", processingPurpose: "Sales communications", lawfulBasis: LawfulBasis.LEGITIMATE_INTERESTS },
      // HR
      { tenantId: tenant.id, systemId: hrSystem.id, category: "IDENTIFICATION", processingPurpose: "Employee identification", lawfulBasis: LawfulBasis.CONTRACT },
      { tenantId: tenant.id, systemId: hrSystem.id, category: "CONTACT", processingPurpose: "Employee communication", lawfulBasis: LawfulBasis.CONTRACT },
      { tenantId: tenant.id, systemId: hrSystem.id, category: "HR", processingPurpose: "Employment management, payroll", lawfulBasis: LawfulBasis.CONTRACT, retentionPeriod: "Employment + 10 years", retentionDays: 3650 },
      { tenantId: tenant.id, systemId: hrSystem.id, category: "HEALTH", processingPurpose: "Occupational health records", lawfulBasis: LawfulBasis.LEGAL_OBLIGATION, retentionPeriod: "Employment + 10 years", retentionDays: 3650 },
      { tenantId: tenant.id, systemId: hrSystem.id, category: "PAYMENT", processingPurpose: "Payroll processing", lawfulBasis: LawfulBasis.CONTRACT },
      // Analytics
      { tenantId: tenant.id, systemId: analyticsSystem.id, category: "ONLINE_TECHNICAL", processingPurpose: "Product analytics and improvement", lawfulBasis: LawfulBasis.LEGITIMATE_INTERESTS, retentionPeriod: "24 months", retentionDays: 730 },
      { tenantId: tenant.id, systemId: analyticsSystem.id, category: "IDENTIFICATION", processingPurpose: "User identification for analytics", lawfulBasis: LawfulBasis.LEGITIMATE_INTERESTS },
      // Email Marketing
      { tenantId: tenant.id, systemId: emailSystem.id, category: "CONTACT", processingPurpose: "Marketing email delivery", lawfulBasis: LawfulBasis.CONSENT },
      { tenantId: tenant.id, systemId: emailSystem.id, category: "ONLINE_TECHNICAL", processingPurpose: "Email engagement tracking", lawfulBasis: LawfulBasis.CONSENT },
      // M365
      { tenantId: tenant.id, systemId: m365System.id, category: "IDENTIFICATION", processingPurpose: "User directory management", lawfulBasis: LawfulBasis.CONTRACT },
      { tenantId: tenant.id, systemId: m365System.id, category: "COMMUNICATION", processingPurpose: "Business email and collaboration", lawfulBasis: LawfulBasis.CONTRACT, retentionPeriod: "5 years", retentionDays: 1825 },
      { tenantId: tenant.id, systemId: m365System.id, category: "CONTACT", processingPurpose: "Employee contacts", lawfulBasis: LawfulBasis.CONTRACT },
      // Finance
      { tenantId: tenant.id, systemId: financeSystem.id, category: "PAYMENT", processingPurpose: "Billing and payment processing", lawfulBasis: LawfulBasis.CONTRACT, retentionPeriod: "7 years (tax)", retentionDays: 2555 },
      { tenantId: tenant.id, systemId: financeSystem.id, category: "IDENTIFICATION", processingPurpose: "Customer billing identification", lawfulBasis: LawfulBasis.CONTRACT },
      { tenantId: tenant.id, systemId: financeSystem.id, category: "CREDITWORTHINESS", processingPurpose: "Credit assessment", lawfulBasis: LawfulBasis.LEGITIMATE_INTERESTS },
      // Support
      { tenantId: tenant.id, systemId: supportSystem.id, category: "IDENTIFICATION", processingPurpose: "Ticket resolution", lawfulBasis: LawfulBasis.CONTRACT },
      { tenantId: tenant.id, systemId: supportSystem.id, category: "CONTACT", processingPurpose: "Support communication", lawfulBasis: LawfulBasis.CONTRACT },
      { tenantId: tenant.id, systemId: supportSystem.id, category: "COMMUNICATION", processingPurpose: "Support ticket history", lawfulBasis: LawfulBasis.LEGITIMATE_INTERESTS, retentionPeriod: "3 years", retentionDays: 1095 },
      // HubSpot
      { tenantId: tenant.id, systemId: marketingSystem.id, category: "CONTACT", processingPurpose: "Marketing outreach", lawfulBasis: LawfulBasis.CONSENT },
      { tenantId: tenant.id, systemId: marketingSystem.id, category: "ONLINE_TECHNICAL", processingPurpose: "Website tracking", lawfulBasis: LawfulBasis.CONSENT },
    ],
  });

  console.log("Created system data categories");

  // ── System Processors (Vendors) ───────────────────────────────────────
  await prisma.systemProcessor.createMany({
    data: [
      { tenantId: tenant.id, systemId: crmSystem.id, vendorName: "Salesforce Inc.", role: ProcessorRole.PROCESSOR, dpaOnFile: true, contractReference: "DPA-2024-001" },
      { tenantId: tenant.id, systemId: hrSystem.id, vendorName: "Workday Inc.", role: ProcessorRole.PROCESSOR, dpaOnFile: true, contractReference: "DPA-2024-002" },
      { tenantId: tenant.id, systemId: analyticsSystem.id, vendorName: "Mixpanel Inc.", role: ProcessorRole.PROCESSOR, dpaOnFile: true, contractReference: "DPA-2024-003" },
      { tenantId: tenant.id, systemId: emailSystem.id, vendorName: "Intuit (Mailchimp)", role: ProcessorRole.PROCESSOR, dpaOnFile: true, contractReference: "DPA-2024-004" },
      { tenantId: tenant.id, systemId: m365System.id, vendorName: "Microsoft Corporation", role: ProcessorRole.PROCESSOR, dpaOnFile: true, contractReference: "DPA-2024-005" },
      { tenantId: tenant.id, systemId: financeSystem.id, vendorName: "SAP SE", role: ProcessorRole.PROCESSOR, dpaOnFile: true, contractReference: "DPA-2024-006" },
      { tenantId: tenant.id, systemId: supportSystem.id, vendorName: "Zendesk Inc.", role: ProcessorRole.PROCESSOR, dpaOnFile: true, contractReference: "DPA-2024-007" },
      { tenantId: tenant.id, systemId: supportSystem.id, vendorName: "AWS (Zendesk hosting)", role: ProcessorRole.SUBPROCESSOR, dpaOnFile: true },
      { tenantId: tenant.id, systemId: iamSystem.id, vendorName: "Okta Inc.", role: ProcessorRole.PROCESSOR, dpaOnFile: true, contractReference: "DPA-2024-008" },
      { tenantId: tenant.id, systemId: marketingSystem.id, vendorName: "HubSpot Inc.", role: ProcessorRole.PROCESSOR, dpaOnFile: true, contractReference: "DPA-2024-009" },
    ],
  });

  console.log("Created system processors");

  // ── Discovery Rules ───────────────────────────────────────────────────
  await prisma.discoveryRule.createMany({
    data: [
      // Customer-facing systems → ACCESS/ERASURE/PORTABILITY for customer subjects
      { tenantId: tenant.id, name: "CRM: Customer data (all DSAR types)", dsarTypes: [DSARType.ACCESS, DSARType.ERASURE, DSARType.RECTIFICATION, DSARType.PORTABILITY], dataSubjectTypes: ["customer"], identifierTypes: ["email", "customerId", "phone"], systemId: crmSystem.id, weight: 90, active: true },
      { tenantId: tenant.id, name: "Support: Customer tickets", dsarTypes: [DSARType.ACCESS, DSARType.ERASURE], dataSubjectTypes: ["customer"], identifierTypes: ["email", "phone"], systemId: supportSystem.id, weight: 75, active: true },
      { tenantId: tenant.id, name: "Email Marketing: Subscriber data", dsarTypes: [DSARType.ACCESS, DSARType.ERASURE, DSARType.OBJECTION], dataSubjectTypes: ["customer"], identifierTypes: ["email"], systemId: emailSystem.id, weight: 70, active: true },
      { tenantId: tenant.id, name: "Analytics: Behavioral data", dsarTypes: [DSARType.ACCESS, DSARType.ERASURE], dataSubjectTypes: ["customer", "visitor"], identifierTypes: ["email", "customerId"], systemId: analyticsSystem.id, weight: 60, active: true },
      { tenantId: tenant.id, name: "HubSpot: Marketing data", dsarTypes: [DSARType.ACCESS, DSARType.ERASURE, DSARType.OBJECTION], dataSubjectTypes: ["customer"], identifierTypes: ["email", "phone", "customerId"], systemId: marketingSystem.id, weight: 65, active: true },
      { tenantId: tenant.id, name: "Finance: Billing records", dsarTypes: [DSARType.ACCESS, DSARType.RECTIFICATION], dataSubjectTypes: ["customer"], identifierTypes: ["email", "customerId"], systemId: financeSystem.id, weight: 80, active: true },
      // Employee-facing systems
      { tenantId: tenant.id, name: "HR: Employee data (all types)", dsarTypes: [DSARType.ACCESS, DSARType.ERASURE, DSARType.RECTIFICATION, DSARType.PORTABILITY], dataSubjectTypes: ["employee"], identifierTypes: ["email", "employeeId"], systemId: hrSystem.id, weight: 95, active: true },
      { tenantId: tenant.id, name: "M365: Employee mailbox & files", dsarTypes: [DSARType.ACCESS, DSARType.ERASURE, DSARType.PORTABILITY], dataSubjectTypes: ["employee"], identifierTypes: ["email", "employeeId"], systemId: m365System.id, weight: 85, active: true },
      { tenantId: tenant.id, name: "IAM: Identity records", dsarTypes: [DSARType.ACCESS, DSARType.ERASURE], dataSubjectTypes: ["employee", "customer"], identifierTypes: ["email", "employeeId"], systemId: iamSystem.id, weight: 70, active: true },
      // CRM also relevant for employee DSARs (internal contacts)
      { tenantId: tenant.id, name: "CRM: Employee contact data", dsarTypes: [DSARType.ACCESS], dataSubjectTypes: ["employee"], identifierTypes: ["email"], systemId: crmSystem.id, weight: 40, active: true },
    ],
  });

  console.log("Created discovery rules");

  // Helper for due dates
  const daysFromNow = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  const daysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };

  // Create integrations — Phase 1 (Microsoft)
  const m365Integration = await prisma.integration.create({
    data: {
      tenantId: tenant.id,
      provider: "M365",
      name: "Acme Entra ID / User Directory",
      status: "ENABLED",
      config: {
        tenantId: "acme-corp-tenant-id",
        clientId: "acme-m365-client-id",
      },
      healthStatus: "HEALTHY",
      lastHealthCheckAt: new Date(),
      lastSuccessAt: new Date(),
      ownerUserId: admin.id,
    },
  });

  const exchangeIntegration = await prisma.integration.create({
    data: {
      tenantId: tenant.id,
      provider: "EXCHANGE_ONLINE",
      name: "Acme Exchange Online",
      status: "ENABLED",
      config: {
        tenantId: "acme-corp-tenant-id",
        clientId: "acme-exo-client-id",
        allowedMailboxes: "",
      },
      healthStatus: "HEALTHY",
      lastHealthCheckAt: new Date(),
      lastSuccessAt: daysAgo(1),
      ownerUserId: admin.id,
    },
  });

  const spIntegration = await prisma.integration.create({
    data: {
      tenantId: tenant.id,
      provider: "SHAREPOINT",
      name: "Acme SharePoint Online",
      status: "ENABLED",
      config: {
        tenantId: "acme-corp-tenant-id",
        clientId: "acme-sp-client-id",
        allowedSiteIds: "finance-site,hr-site",
      },
      healthStatus: "HEALTHY",
      lastHealthCheckAt: new Date(),
      lastSuccessAt: daysAgo(1),
      ownerUserId: admin.id,
    },
  });

  const onedriveIntegration = await prisma.integration.create({
    data: {
      tenantId: tenant.id,
      provider: "ONEDRIVE",
      name: "Acme OneDrive for Business",
      status: "ENABLED",
      config: {
        tenantId: "acme-corp-tenant-id",
        clientId: "acme-od-client-id",
      },
      healthStatus: "HEALTHY",
      lastHealthCheckAt: new Date(),
      lastSuccessAt: daysAgo(2),
      ownerUserId: admin.id,
    },
  });

  // Phase 2 stub
  const sfIntegration = await prisma.integration.create({
    data: {
      tenantId: tenant.id,
      provider: "SALESFORCE",
      name: "Acme Salesforce CRM",
      status: "DISABLED",
      config: {
        instanceUrl: "https://acme-corp.salesforce.com",
        clientId: "acme-sf-consumer-key",
      },
      healthStatus: "NOT_CONFIGURED",
      ownerUserId: admin.id,
    },
  });

  console.log("Created 5 integrations (4 Phase 1, 1 Phase 2 stub)");

  // Create data subjects
  const subject1 = await prisma.dataSubject.create({
    data: {
      tenantId: tenant.id,
      fullName: "John Smith",
      email: "john.smith@example.com",
      phone: "+1-555-0101",
      address: "123 Main St, Springfield, IL 62701",
      preferredLanguage: "en",
      notes: "Longtime customer since 2019",
    },
  });

  const subject2 = await prisma.dataSubject.create({
    data: {
      tenantId: tenant.id,
      fullName: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "+1-555-0102",
      address: "456 Oak Ave, Portland, OR 97201",
      preferredLanguage: "en",
    },
  });

  const subject3 = await prisma.dataSubject.create({
    data: {
      tenantId: tenant.id,
      fullName: "Robert Johnson",
      email: "rjohnson@example.com",
      phone: "+1-555-0103",
      preferredLanguage: "en",
    },
  });

  const subject4 = await prisma.dataSubject.create({
    data: {
      tenantId: tenant.id,
      fullName: "Emily Chen",
      email: "emily.chen@example.com",
      preferredLanguage: "de",
    },
  });

  console.log("Created 4 data subjects");

  // Create DSAR cases
  const case1 = await prisma.dSARCase.create({
    data: {
      tenantId: tenant.id,
      caseNumber: "DSAR-2026-A1B2C3",
      type: DSARType.ACCESS,
      status: CaseStatus.DATA_COLLECTION,
      priority: CasePriority.HIGH,
      receivedAt: daysAgo(15),
      dueDate: daysFromNow(15),
      channel: "Email",
      requesterType: "Data Subject",
      description: "Subject requests access to all personal data held by the company.",
      identityVerified: true,
      dataSubjectId: subject1.id,
      createdByUserId: admin.id,
      assignedToUserId: caseManager.id,
    },
  });

  const case2 = await prisma.dSARCase.create({
    data: {
      tenantId: tenant.id,
      caseNumber: "DSAR-2026-D4E5F6",
      type: DSARType.ERASURE,
      status: CaseStatus.REVIEW_LEGAL,
      priority: CasePriority.CRITICAL,
      receivedAt: daysAgo(25),
      dueDate: daysFromNow(5),
      channel: "Web Portal",
      requesterType: "Data Subject",
      description: "Subject requests complete erasure of all personal data under right to be forgotten.",
      identityVerified: true,
      dataSubjectId: subject2.id,
      createdByUserId: caseManager.id,
      assignedToUserId: dpo.id,
    },
  });

  const case3 = await prisma.dSARCase.create({
    data: {
      tenantId: tenant.id,
      caseNumber: "DSAR-2026-G7H8I9",
      type: DSARType.RECTIFICATION,
      status: CaseStatus.NEW,
      priority: CasePriority.MEDIUM,
      receivedAt: daysAgo(2),
      dueDate: daysFromNow(28),
      channel: "Phone",
      requesterType: "Authorized Agent",
      description: "Agent requests correction of address and phone number on behalf of data subject.",
      dataSubjectId: subject3.id,
      createdByUserId: admin.id,
      assignedToUserId: null,
    },
  });

  const case4 = await prisma.dSARCase.create({
    data: {
      tenantId: tenant.id,
      caseNumber: "DSAR-2026-J0K1L2",
      type: DSARType.PORTABILITY,
      status: CaseStatus.RESPONSE_SENT,
      priority: CasePriority.LOW,
      receivedAt: daysAgo(28),
      dueDate: daysFromNow(2),
      channel: "Email",
      requesterType: "Data Subject",
      description: "Subject requests export of all data in machine-readable format.",
      identityVerified: true,
      dataSubjectId: subject4.id,
      createdByUserId: caseManager.id,
      assignedToUserId: caseManager.id,
    },
  });

  const case5 = await prisma.dSARCase.create({
    data: {
      tenantId: tenant.id,
      caseNumber: "DSAR-2026-M3N4O5",
      type: DSARType.OBJECTION,
      status: CaseStatus.REJECTED,
      priority: CasePriority.MEDIUM,
      receivedAt: daysAgo(40),
      dueDate: daysAgo(10),
      channel: "Email",
      requesterType: "Data Subject",
      description: "Subject objects to processing for direct marketing. Rejected: not a valid data subject.",
      dataSubjectId: subject1.id,
      createdByUserId: admin.id,
      assignedToUserId: dpo.id,
    },
  });

  console.log("Created 5 DSAR cases");

  // ── Case-System Links ─────────────────────────────────────────────────
  await prisma.caseSystemLink.createMany({
    data: [
      // Case 1 (ACCESS, John Smith — customer)
      { tenantId: tenant.id, caseId: case1.id, systemId: crmSystem.id, collectionStatus: "IN_PROGRESS", suggestedByDiscovery: true, discoveryScore: 95, discoveryReason: "CRM: Customer data rule matched (email + customerId)" },
      { tenantId: tenant.id, caseId: case1.id, systemId: analyticsSystem.id, collectionStatus: "PENDING", suggestedByDiscovery: true, discoveryScore: 72, discoveryReason: "Analytics: Behavioral data rule matched (email)" },
      { tenantId: tenant.id, caseId: case1.id, systemId: emailSystem.id, collectionStatus: "PENDING", suggestedByDiscovery: true, discoveryScore: 68, discoveryReason: "Email Marketing: Subscriber data rule matched (email)" },
      { tenantId: tenant.id, caseId: case1.id, systemId: supportSystem.id, collectionStatus: "COMPLETED", suggestedByDiscovery: true, discoveryScore: 78, discoveryReason: "Support: Customer tickets rule matched (email)" },
      { tenantId: tenant.id, caseId: case1.id, systemId: hrSystem.id, collectionStatus: "NOT_APPLICABLE", suggestedByDiscovery: false, notes: "No employee records found for this data subject" },
      // Case 2 (ERASURE, Jane Doe — customer)
      { tenantId: tenant.id, caseId: case2.id, systemId: crmSystem.id, collectionStatus: "COMPLETED", suggestedByDiscovery: true, discoveryScore: 95 },
      { tenantId: tenant.id, caseId: case2.id, systemId: emailSystem.id, collectionStatus: "COMPLETED", suggestedByDiscovery: true, discoveryScore: 70 },
      { tenantId: tenant.id, caseId: case2.id, systemId: m365System.id, collectionStatus: "COMPLETED", suggestedByDiscovery: false },
      // Case 3 (RECTIFICATION, Robert Johnson)
      { tenantId: tenant.id, caseId: case3.id, systemId: crmSystem.id, collectionStatus: "PENDING", suggestedByDiscovery: true, discoveryScore: 90 },
    ],
  });

  console.log("Created case-system links");

  // State transitions for case1
  await prisma.dSARStateTransition.createMany({
    data: [
      {
        tenantId: tenant.id,
        caseId: case1.id,
        fromStatus: CaseStatus.NEW,
        toStatus: CaseStatus.IDENTITY_VERIFICATION,
        changedByUserId: admin.id,
        changedAt: daysAgo(14),
        reason: "Identity documents requested from subject",
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        fromStatus: CaseStatus.IDENTITY_VERIFICATION,
        toStatus: CaseStatus.INTAKE_TRIAGE,
        changedByUserId: admin.id,
        changedAt: daysAgo(12),
        reason: "Identity verified via passport copy",
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        fromStatus: CaseStatus.INTAKE_TRIAGE,
        toStatus: CaseStatus.DATA_COLLECTION,
        changedByUserId: caseManager.id,
        changedAt: daysAgo(10),
        reason: "Triage complete. Assigned to data collection across CRM and Analytics.",
      },
    ],
  });

  // State transitions for case2
  await prisma.dSARStateTransition.createMany({
    data: [
      {
        tenantId: tenant.id,
        caseId: case2.id,
        fromStatus: CaseStatus.NEW,
        toStatus: CaseStatus.INTAKE_TRIAGE,
        changedByUserId: caseManager.id,
        changedAt: daysAgo(24),
        reason: "Erasure request triaged - high impact",
      },
      {
        tenantId: tenant.id,
        caseId: case2.id,
        fromStatus: CaseStatus.INTAKE_TRIAGE,
        toStatus: CaseStatus.DATA_COLLECTION,
        changedByUserId: caseManager.id,
        changedAt: daysAgo(20),
        reason: "Collecting data locations across all systems",
      },
      {
        tenantId: tenant.id,
        caseId: case2.id,
        fromStatus: CaseStatus.DATA_COLLECTION,
        toStatus: CaseStatus.REVIEW_LEGAL,
        changedByUserId: caseManager.id,
        changedAt: daysAgo(10),
        reason: "Data mapping complete. Legal review needed for retention exceptions.",
      },
    ],
  });

  // State transitions for case5 (rejected)
  await prisma.dSARStateTransition.createMany({
    data: [
      {
        tenantId: tenant.id,
        caseId: case5.id,
        fromStatus: CaseStatus.NEW,
        toStatus: CaseStatus.IDENTITY_VERIFICATION,
        changedByUserId: admin.id,
        changedAt: daysAgo(38),
        reason: "Requesting identity verification",
      },
      {
        tenantId: tenant.id,
        caseId: case5.id,
        fromStatus: CaseStatus.IDENTITY_VERIFICATION,
        toStatus: CaseStatus.REJECTED,
        changedByUserId: dpo.id,
        changedAt: daysAgo(35),
        reason: "Unable to verify identity. Requester could not provide sufficient identification.",
      },
    ],
  });

  console.log("Created state transitions");

  // Tasks for case1
  await prisma.task.createMany({
    data: [
      {
        tenantId: tenant.id,
        caseId: case1.id,
        title: "Extract CRM records for John Smith",
        description: "Pull all customer records from Salesforce CRM",
        status: TaskStatus.IN_PROGRESS,
        assigneeUserId: contributor.id,
        dueDate: daysFromNow(5),
        systemId: crmSystem.id,
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        title: "Extract analytics data",
        description: "Export behavioral data from Mixpanel for this user",
        status: TaskStatus.OPEN,
        assigneeUserId: contributor.id,
        dueDate: daysFromNow(7),
        systemId: analyticsSystem.id,
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        title: "Check HR records",
        description: "Verify if subject has any employee records",
        status: TaskStatus.DONE,
        assigneeUserId: caseManager.id,
        dueDate: daysAgo(3),
        systemId: hrSystem.id,
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        title: "Check email marketing lists",
        description: "Look up subject in Mailchimp subscriber lists and campaigns",
        status: TaskStatus.OPEN,
        assigneeUserId: contributor.id,
        dueDate: daysFromNow(6),
        systemId: emailSystem.id,
      },
    ],
  });

  // Tasks for case2
  await prisma.task.createMany({
    data: [
      {
        tenantId: tenant.id,
        caseId: case2.id,
        title: "Legal review: retention requirements",
        description: "Check if any legal retention obligations prevent erasure",
        status: TaskStatus.IN_PROGRESS,
        assigneeUserId: dpo.id,
        dueDate: daysFromNow(2),
      },
      {
        tenantId: tenant.id,
        caseId: case2.id,
        title: "Prepare erasure plan",
        description: "Document which systems need data deleted and the order of operations",
        status: TaskStatus.BLOCKED,
        assigneeUserId: caseManager.id,
        dueDate: daysFromNow(4),
      },
    ],
  });

  console.log("Created tasks");

  // Comments
  await prisma.comment.createMany({
    data: [
      {
        tenantId: tenant.id,
        caseId: case1.id,
        authorUserId: admin.id,
        body: "Case opened. Subject provided clear identification. Proceeding with standard access request workflow.",
        createdAt: daysAgo(14),
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        authorUserId: caseManager.id,
        body: "Data collection in progress. CRM extraction started. Analytics team notified.",
        createdAt: daysAgo(9),
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        authorUserId: contributor.id,
        body: "HR records checked - no employee data found for this subject. Marking HR task as done.",
        createdAt: daysAgo(5),
      },
      {
        tenantId: tenant.id,
        caseId: case2.id,
        authorUserId: dpo.id,
        body: "This is a complex erasure case. We need to verify retention obligations under financial regulations before proceeding.",
        createdAt: daysAgo(10),
      },
      {
        tenantId: tenant.id,
        caseId: case2.id,
        authorUserId: caseManager.id,
        body: "Data mapping complete. Found data in CRM, Analytics, and backup systems. Awaiting legal clearance.",
        createdAt: daysAgo(8),
      },
    ],
  });

  console.log("Created comments");

  // ── Communication Logs ──────────────────────────────────────────────

  await prisma.communicationLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        caseId: case1.id,
        direction: "INBOUND",
        channel: "EMAIL",
        subject: "Data Access Request - John Smith",
        body: "Dear Data Protection Team,\n\nI am writing to exercise my right of access under Article 15 of the GDPR. Please provide me with a copy of all personal data you hold about me.\n\nRegards,\nJohn Smith",
        sentAt: daysAgo(15),
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        direction: "OUTBOUND",
        channel: "EMAIL",
        subject: "RE: Data Access Request - Acknowledgment",
        body: "Dear Mr. Smith,\n\nThank you for your data access request. We have received your request and assigned it case number DSAR-2026-A1B2C3.\n\nWe will respond within the statutory 30-day period. To proceed, we require identity verification. Please provide a copy of a government-issued photo ID.\n\nBest regards,\nAcme Corp Privacy Team",
        sentAt: daysAgo(14),
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        direction: "INBOUND",
        channel: "EMAIL",
        subject: "RE: Data Access Request - ID Verification",
        body: "Please find attached a copy of my passport for identity verification purposes.\n\nRegards,\nJohn Smith",
        sentAt: daysAgo(13),
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        direction: "OUTBOUND",
        channel: "EMAIL",
        subject: "RE: Data Access Request - Identity Confirmed",
        body: "Dear Mr. Smith,\n\nYour identity has been verified. We are now collecting your personal data from our systems and will provide you with a comprehensive response.\n\nBest regards,\nAcme Corp Privacy Team",
        sentAt: daysAgo(12),
      },
      {
        tenantId: tenant.id,
        caseId: case2.id,
        direction: "INBOUND",
        channel: "PORTAL",
        subject: "Erasure Request",
        body: "I request the complete deletion of all my personal data from your systems under Article 17 of the GDPR (Right to Erasure).",
        sentAt: daysAgo(25),
      },
      {
        tenantId: tenant.id,
        caseId: case2.id,
        direction: "OUTBOUND",
        channel: "EMAIL",
        subject: "Erasure Request - Under Review",
        body: "Dear Ms. Doe,\n\nWe have received your erasure request (case DSAR-2026-D4E5F6). Please note that this request is currently under legal review as we need to assess potential retention obligations.\n\nWe will update you shortly.\n\nBest regards,\nAcme Corp Privacy Team",
        sentAt: daysAgo(20),
      },
      {
        tenantId: tenant.id,
        caseId: case3.id,
        direction: "INBOUND",
        channel: "PHONE",
        subject: "Rectification Request via Phone",
        body: "Authorized agent called on behalf of Robert Johnson requesting correction of address and phone number in our records. New address: 789 Pine Rd, Austin, TX 78701. New phone: +1-555-0199.",
        sentAt: daysAgo(2),
      },
    ],
  });

  console.log("Created communication logs");

  // ── Data Collection Items (standardised QuerySpec format) ────────────

  await prisma.dataCollectionItem.createMany({
    data: [
      // Case 1 — manual system collection
      {
        tenantId: tenant.id,
        caseId: case1.id,
        systemId: crmSystem.id,
        querySpec: {
          subjectIdentifiers: { primary: { type: "email", value: "john.smith@example.com" }, alternatives: [] },
          providerScope: {},
          outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
          legal: { purpose: "DSAR", dataMinimization: true },
        },
        status: "IN_PROGRESS",
        findingsSummary: "Customer record found with purchase history and support tickets",
        recordsFound: 47,
        assignedToUserId: contributor.id,
        startedAt: daysAgo(8),
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        systemId: hrSystem.id,
        querySpec: {
          subjectIdentifiers: { primary: { type: "email", value: "john.smith@example.com" }, alternatives: [{ type: "name", value: "John Smith" }] },
          providerScope: {},
          outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
          legal: { purpose: "DSAR", dataMinimization: true },
        },
        status: "COMPLETED",
        findingsSummary: "No employee records found for this data subject",
        recordsFound: 0,
        completedAt: daysAgo(5),
        assignedToUserId: caseManager.id,
      },
      // Case 1 — Exchange mailbox search via integration
      {
        tenantId: tenant.id,
        caseId: case1.id,
        integrationId: exchangeIntegration.id,
        systemLabel: "Exchange Online - Mailbox Search",
        querySpec: {
          subjectIdentifiers: { primary: { type: "email", value: "john.smith@example.com" }, alternatives: [] },
          searchTerms: { terms: ["john smith", "john.smith"], matchType: "contains" },
          providerScope: { mailboxes: ["john.smith@example.com"], folderScope: "all", includeAttachments: false },
          outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
          legal: { purpose: "DSAR", dataMinimization: true },
          templateId: "exchange_mailbox_search",
        },
        status: "PENDING",
        assignedToUserId: contributor.id,
      },
      // Case 1 — manual email marketing
      {
        tenantId: tenant.id,
        caseId: case1.id,
        systemId: emailSystem.id,
        querySpec: {
          subjectIdentifiers: { primary: { type: "email", value: "john.smith@example.com" }, alternatives: [] },
          providerScope: {},
          outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
          legal: { purpose: "DSAR", dataMinimization: true },
        },
        status: "PENDING",
        assignedToUserId: contributor.id,
      },
      // Case 2 — CRM completed
      {
        tenantId: tenant.id,
        caseId: case2.id,
        systemId: crmSystem.id,
        querySpec: {
          subjectIdentifiers: { primary: { type: "email", value: "jane.doe@example.com" }, alternatives: [] },
          providerScope: {},
          outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
          legal: { purpose: "DSAR", dataMinimization: true },
        },
        status: "COMPLETED",
        findingsSummary: "Found 23 CRM records including contact info, purchase history, and support interactions",
        recordsFound: 23,
        completedAt: daysAgo(12),
        assignedToUserId: contributor.id,
      },
      // Case 2 — Entra ID user lookup completed
      {
        tenantId: tenant.id,
        caseId: case2.id,
        integrationId: m365Integration.id,
        systemLabel: "Entra ID - User Profile",
        querySpec: {
          subjectIdentifiers: { primary: { type: "email", value: "jane.doe@example.com" }, alternatives: [] },
          providerScope: { lookupType: "user_profile" },
          outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
          legal: { purpose: "DSAR", dataMinimization: true },
          templateId: "m365_user_lookup",
        },
        status: "COMPLETED",
        findingsSummary: "User profile found in Entra ID with department and contact info",
        recordsFound: 1,
        completedAt: daysAgo(11),
        resultMetadata: {
          provider: "M365", workload: "entra_id",
          counts: { matched: 1, exported: 1, attachments: 0, skipped: 0 },
          artifacts: [],
          runInfo: { startedAt: daysAgo(11).toISOString(), completedAt: daysAgo(11).toISOString(), status: "success", durationMs: 1200 },
          notes: "metadata only; displayName, mail, department, jobTitle exported",
        },
        assignedToUserId: contributor.id,
      },
      // Case 2 — SharePoint site search completed
      {
        tenantId: tenant.id,
        caseId: case2.id,
        integrationId: spIntegration.id,
        systemLabel: "SharePoint - Finance Site",
        querySpec: {
          subjectIdentifiers: { primary: { type: "email", value: "jane.doe@example.com" }, alternatives: [{ type: "name", value: "Jane Doe" }] },
          searchTerms: { terms: ["jane doe"], matchType: "contains" },
          providerScope: { siteIds: ["finance-site"], fileTypes: ["docx", "pdf", "xlsx"] },
          outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
          legal: { purpose: "DSAR", dataMinimization: true },
          templateId: "sharepoint_site_search",
        },
        status: "COMPLETED",
        findingsSummary: "Found 3 documents referencing data subject on Finance SharePoint site",
        recordsFound: 3,
        completedAt: daysAgo(11),
        resultMetadata: {
          provider: "SHAREPOINT", workload: "site_search",
          counts: { matched: 3, exported: 3, attachments: 0, skipped: 0 },
          artifacts: [{ type: "index_csv", filename: "sharepoint-finance-index.csv", description: "Index of matched files" }],
          runInfo: { startedAt: daysAgo(11).toISOString(), completedAt: daysAgo(11).toISOString(), status: "success", durationMs: 3400 },
        },
        assignedToUserId: caseManager.id,
      },
      // Case 2 — OneDrive search completed
      {
        tenantId: tenant.id,
        caseId: case2.id,
        integrationId: onedriveIntegration.id,
        systemLabel: "OneDrive - User Drive",
        querySpec: {
          subjectIdentifiers: { primary: { type: "email", value: "jane.doe@example.com" }, alternatives: [] },
          providerScope: { userDrive: true },
          outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
          legal: { purpose: "DSAR", dataMinimization: true },
          templateId: "onedrive_user_drive",
        },
        status: "COMPLETED",
        findingsSummary: "5 personal files found in user's OneDrive",
        recordsFound: 5,
        completedAt: daysAgo(11),
        resultMetadata: {
          provider: "ONEDRIVE", workload: "user_drive",
          counts: { matched: 5, exported: 5, attachments: 0, skipped: 0 },
          artifacts: [{ type: "index_csv", filename: "onedrive-jane-index.csv", description: "Index of user drive files" }],
          runInfo: { startedAt: daysAgo(11).toISOString(), completedAt: daysAgo(11).toISOString(), status: "success", durationMs: 2100 },
        },
        assignedToUserId: contributor.id,
      },
      // Case 2 — email marketing completed
      {
        tenantId: tenant.id,
        caseId: case2.id,
        systemId: emailSystem.id,
        querySpec: {
          subjectIdentifiers: { primary: { type: "email", value: "jane.doe@example.com" }, alternatives: [] },
          providerScope: {},
          outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
          legal: { purpose: "DSAR", dataMinimization: true },
        },
        status: "COMPLETED",
        findingsSummary: "Subscribed to 3 mailing lists, 12 campaigns delivered",
        recordsFound: 15,
        completedAt: daysAgo(11),
      },
    ],
  });

  console.log("Created data collection items");

  // ── Legal Reviews ───────────────────────────────────────────────────

  await prisma.legalReview.createMany({
    data: [
      {
        tenantId: tenant.id,
        caseId: case2.id,
        status: "IN_REVIEW",
        issues: "Financial transaction records may be subject to 7-year retention requirement under tax regulations. Marketing consent records must be retained for proof of consent compliance.",
        exemptionsApplied: ["Tax regulation retention (7 years)", "Legal obligation - Article 17(3)(b)"],
        redactions: null,
        notes: "Need to check with finance department about specific transaction dates before proceeding with partial erasure.",
        reviewerUserId: dpo.id,
      },
      {
        tenantId: tenant.id,
        caseId: case1.id,
        status: "PENDING",
        issues: null,
        exemptionsApplied: [],
        notes: "Standard access request - review pending until data collection is complete.",
        reviewerUserId: dpo.id,
      },
      {
        tenantId: tenant.id,
        caseId: case4.id,
        status: "APPROVED",
        issues: "No exemptions needed for portability request.",
        exemptionsApplied: [],
        redactions: "Third-party email addresses redacted from exported communications.",
        notes: "Data export approved. Machine-readable JSON format used as requested.",
        reviewerUserId: dpo.id,
        approvedAt: daysAgo(5),
      },
    ],
  });

  console.log("Created legal reviews");

  // Audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "LOGIN",
        entityType: "User",
        entityId: admin.id,
        details: { method: "credentials" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "CREATE",
        entityType: "DSARCase",
        entityId: case1.id,
        details: { caseNumber: case1.caseNumber, type: "ACCESS" },
      },
      {
        tenantId: tenant.id,
        actorUserId: caseManager.id,
        action: "STATUS_TRANSITION",
        entityType: "DSARCase",
        entityId: case1.id,
        details: { from: "INTAKE_TRIAGE", to: "DATA_COLLECTION" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "CREATE",
        entityType: "DSARCase",
        entityId: case2.id,
        details: { caseNumber: case2.caseNumber, type: "ERASURE" },
      },
      {
        tenantId: tenant.id,
        actorUserId: dpo.id,
        action: "STATUS_TRANSITION",
        entityType: "DSARCase",
        entityId: case5.id,
        details: { from: "IDENTITY_VERIFICATION", to: "REJECTED" },
      },
      {
        tenantId: tenant.id,
        actorUserId: dpo.id,
        action: "legal_review.created",
        entityType: "LegalReview",
        entityId: case2.id,
        details: { caseNumber: case2.caseNumber, status: "IN_REVIEW" },
      },
      {
        tenantId: tenant.id,
        actorUserId: caseManager.id,
        action: "data_collection.created",
        entityType: "DataCollectionItem",
        entityId: case1.id,
        details: { system: "CRM System", status: "IN_PROGRESS" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "INTEGRATION_CREATED",
        entityType: "Integration",
        entityId: m365Integration.id,
        details: { provider: "M365", name: "Acme Entra ID / User Directory" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "INTEGRATION_ENABLED",
        entityType: "Integration",
        entityId: m365Integration.id,
        details: { provider: "M365" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "INTEGRATION_TESTED",
        entityType: "Integration",
        entityId: m365Integration.id,
        details: { provider: "M365", healthy: true, message: "Connected successfully" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "INTEGRATION_CREATED",
        entityType: "Integration",
        entityId: exchangeIntegration.id,
        details: { provider: "EXCHANGE_ONLINE", name: "Acme Exchange Online" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "INTEGRATION_ENABLED",
        entityType: "Integration",
        entityId: exchangeIntegration.id,
        details: { provider: "EXCHANGE_ONLINE" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "INTEGRATION_CREATED",
        entityType: "Integration",
        entityId: spIntegration.id,
        details: { provider: "SHAREPOINT", name: "Acme SharePoint Online" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "INTEGRATION_CREATED",
        entityType: "Integration",
        entityId: onedriveIntegration.id,
        details: { provider: "ONEDRIVE", name: "Acme OneDrive for Business" },
      },
      {
        tenantId: tenant.id,
        actorUserId: admin.id,
        action: "INTEGRATION_ENABLED",
        entityType: "Integration",
        entityId: onedriveIntegration.id,
        details: { provider: "ONEDRIVE" },
      },
    ],
  });

  console.log("Created audit logs");

  // ── Privacy Copilot Demo Data ─────────────────────────────────────

  // IdentityProfile for case1 (needed before CopilotQuery references it)
  const identityProfile1 = await prisma.identityProfile.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      displayName: subject1.fullName,
      primaryIdentifierType: PrimaryIdentifierType.EMAIL,
      primaryIdentifierValue: subject1.email!,
      alternateIdentifiers: [
        { type: "email", value: subject1.email, confidence: 0.9, source: "case_data" },
        { type: "name", value: subject1.fullName, confidence: 0.9, source: "case_data" },
        { type: "upn", value: "john.smith@acme-corp.com", confidence: 0.85, source: "M365" },
        { type: "system_account", value: "M365:m365-user-guid-001", confidence: 0.85, source: "M365" },
        { type: "system_account", value: "EXCHANGE_ONLINE:exo-mailbox-guid-001", confidence: 0.8, source: "EXCHANGE_ONLINE" },
      ],
      confidenceScore: 90,
      createdByUserId: caseManager.id,
    },
  });

  // CopilotRun for case1 (John Smith access request, DATA_COLLECTION stage)
  const copilotRun1 = await prisma.copilotRun.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      createdByUserId: caseManager.id,
      status: CopilotRunStatus.COMPLETED,
      justification: "DSAR fulfillment — automated data discovery for personal data access request (Art. 15)",
      scopeSummary: "M365 User Profile + Exchange Online Mailbox Search",
      providerSelection: [
        { integrationId: m365Integration.id, provider: "M365", workload: "user_profile" },
        { integrationId: exchangeIntegration.id, provider: "EXCHANGE_ONLINE", workload: "mailbox_search" },
      ],
      resultSummary: [
        "Discovery run completed. Found 3 evidence items across 2 providers.",
        "Data categories: IDENTIFICATION, CONTACT, COMMUNICATION, HR.",
        "No special category (Art. 9) data detected.",
        "3 findings generated, 0 requiring legal review.",
      ].join(" "),
      containsSpecialCategory: false,
      legalApprovalStatus: LegalApprovalStatus.NOT_REQUIRED,
      totalFindings: 3,
      totalEvidenceItems: 3,
      startedAt: daysAgo(9),
      completedAt: daysAgo(9),
    },
  });

  // CopilotQuery records linked to the run
  const copilotQueryM365 = await prisma.copilotQuery.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      createdByUserId: caseManager.id,
      queryText: "Which personal data exists for John Smith in M365 user directory?",
      queryIntent: QueryIntent.DATA_LOCATION,
      subjectIdentityId: identityProfile1.id,
      executionMode: ContentHandling.METADATA_ONLY,
      integrationId: m365Integration.id,
      provider: "M365",
      querySpec: {
        subjectIdentifiers: { primary: { type: "email", value: subject1.email }, alternatives: [{ type: "name", value: subject1.fullName }] },
        providerScope: { lookupType: "user_profile" },
        outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
        legal: { purpose: "DSAR", dataMinimization: true },
        templateId: "m365_user_lookup",
      },
      status: CopilotQueryStatus.COMPLETED,
      recordsFound: 1,
      executionMs: 1250,
      startedAt: daysAgo(9),
      completedAt: daysAgo(9),
    },
  });

  const copilotQueryExchange = await prisma.copilotQuery.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      createdByUserId: caseManager.id,
      queryText: "Search Exchange Online mailbox for personal data belonging to John Smith",
      queryIntent: QueryIntent.DATA_LOCATION,
      subjectIdentityId: identityProfile1.id,
      executionMode: ContentHandling.METADATA_ONLY,
      integrationId: exchangeIntegration.id,
      provider: "EXCHANGE_ONLINE",
      querySpec: {
        subjectIdentifiers: { primary: { type: "email", value: subject1.email }, alternatives: [] },
        searchTerms: { terms: ["john smith", "john.smith"], matchType: "contains" },
        providerScope: { mailboxes: [subject1.email!], folderScope: "all", includeAttachments: true },
        outputOptions: { mode: "metadata_only", maxItems: 500, includeAttachments: false },
        legal: { purpose: "DSAR", dataMinimization: true },
        templateId: "exchange_mailbox_search",
      },
      status: CopilotQueryStatus.COMPLETED,
      recordsFound: 5,
      executionMs: 3400,
      startedAt: daysAgo(9),
      completedAt: daysAgo(9),
    },
  });

  // EvidenceItem records (3 items matching the 3 findings)
  const evidenceItem1 = await prisma.evidenceItem.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      queryId: copilotQueryM365.id,
      integrationId: m365Integration.id,
      provider: "M365",
      workload: "ENTRA_ID",
      itemType: EvidenceItemType.RECORD,
      externalRef: "m365-user-guid-001",
      location: "EntraID:UserProfile:john.smith@acme-corp.com",
      title: "Entra ID user profile — John Smith",
      createdAtSource: daysAgo(365),
      modifiedAtSource: daysAgo(30),
      owners: { createdBy: "admin@acme-corp.com" },
      metadata: {
        userPrincipalName: "john.smith@acme-corp.com",
        department: "Engineering",
        jobTitle: "Software Developer",
        displayName: subject1.fullName,
        mail: subject1.email,
      },
      contentHandling: ContentHandling.METADATA_ONLY,
      sensitivityScore: 35,
    },
  });

  const evidenceItem2 = await prisma.evidenceItem.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      queryId: copilotQueryExchange.id,
      integrationId: exchangeIntegration.id,
      provider: "EXCHANGE_ONLINE",
      workload: "EXCHANGE",
      itemType: EvidenceItemType.EMAIL,
      externalRef: "exo-message-guid-batch-001",
      location: `Mailbox:${subject1.email}/Inbox,Sent Items`,
      title: "Exchange emails containing personal data (5 messages)",
      createdAtSource: daysAgo(60),
      modifiedAtSource: daysAgo(10),
      owners: { mailbox: subject1.email },
      metadata: {
        matchedFolders: ["Inbox", "Sent Items"],
        messageCount: 5,
        containsAttachments: false,
      },
      contentHandling: ContentHandling.METADATA_ONLY,
      sensitivityScore: 50,
    },
  });

  const evidenceItem3 = await prisma.evidenceItem.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      queryId: copilotQueryExchange.id,
      integrationId: exchangeIntegration.id,
      provider: "EXCHANGE_ONLINE",
      workload: "EXCHANGE",
      itemType: EvidenceItemType.FILE,
      externalRef: "exo-attachment-guid-001",
      location: `Mailbox:${subject1.email}/Inbox/Q4_Compensation_Review.xlsx`,
      title: "Q4_Compensation_Review.xlsx (email attachment)",
      createdAtSource: daysAgo(45),
      modifiedAtSource: daysAgo(45),
      owners: { sender: "hr@acme-corp.com", mailbox: subject1.email },
      metadata: {
        attachmentType: "xlsx",
        attachmentName: "Q4_Compensation_Review.xlsx",
        parentMessageSubject: "Q4 Compensation Review",
      },
      contentHandling: ContentHandling.METADATA_ONLY,
      sensitivityScore: 75,
    },
  });

  // Findings linked to the run (new schema)
  const finding1 = await prisma.finding.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      dataCategory: DataCategory.IDENTIFICATION,
      severity: FindingSeverity.INFO,
      confidence: 0.9,
      summary: "Entra ID user profile containing display name, email, department, and job title.",
      evidenceItemIds: [evidenceItem1.id],
      containsSpecialCategory: false,
      containsThirdPartyDataSuspected: false,
      requiresLegalReview: false,
    },
  });

  const finding2 = await prisma.finding.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      dataCategory: DataCategory.COMMUNICATION,
      severity: FindingSeverity.WARNING,
      confidence: 0.85,
      summary: "Mailbox search returned 5 emails containing personal identifiers including email addresses and a phone number.",
      evidenceItemIds: [evidenceItem2.id],
      containsSpecialCategory: false,
      containsThirdPartyDataSuspected: true,
      requiresLegalReview: false,
    },
  });

  const finding3 = await prisma.finding.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      dataCategory: DataCategory.HR,
      severity: FindingSeverity.CRITICAL,
      confidence: 0.8,
      summary: "Email attachment contains salary information and employment contract details for the data subject.",
      evidenceItemIds: [evidenceItem3.id],
      containsSpecialCategory: false,
      containsThirdPartyDataSuspected: false,
      requiresLegalReview: true,
    },
  });

  // DetectorResult records linked to evidence items (new schema)
  // EvidenceItem 1 (M365 profile): EMAIL detector
  await prisma.detectorResult.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      evidenceItemId: evidenceItem1.id,
      detectorType: "REGEX",
      detectedElements: [
        { elementType: "EMAIL_ADDRESS", confidence: 0.9, snippetPreview: "j***@acme-corp.com", offsets: { start: 0, end: 26 } },
        { elementType: "EMAIL_ADDRESS", confidence: 0.9, snippetPreview: "j***@example.com", offsets: { start: 30, end: 52 } },
      ],
      detectedCategories: [
        { category: "CONTACT", confidence: 0.9 },
        { category: "IDENTIFICATION", confidence: 0.85 },
      ],
      containsSpecialCategorySuspected: false,
    },
  });

  // EvidenceItem 2 (Exchange emails): EMAIL + PHONE detectors
  await prisma.detectorResult.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      evidenceItemId: evidenceItem2.id,
      detectorType: "REGEX",
      detectedElements: [
        { elementType: "EMAIL_ADDRESS", confidence: 0.85, snippetPreview: "j***@acme-corp.com", offsets: { start: 0, end: 26 } },
        { elementType: "EMAIL_ADDRESS", confidence: 0.85, snippetPreview: "j***@example.com", offsets: { start: 100, end: 122 } },
        { elementType: "EMAIL_ADDRESS", confidence: 0.85, snippetPreview: "j***@acme-corp.com", offsets: { start: 200, end: 226 } },
        { elementType: "PHONE_EU_INTERNATIONAL", confidence: 0.75, snippetPreview: "+49 *****42", offsets: { start: 300, end: 318 } },
      ],
      detectedCategories: [
        { category: "CONTACT", confidence: 0.85 },
        { category: "COMMUNICATION", confidence: 0.8 },
      ],
      containsSpecialCategorySuspected: false,
    },
  });

  // EvidenceItem 3 (HR attachment): IBAN detector
  await prisma.detectorResult.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      evidenceItemId: evidenceItem3.id,
      detectorType: "REGEX",
      detectedElements: [
        { elementType: "IBAN_DE", confidence: 0.8, snippetPreview: "DE******0000", offsets: { start: 0, end: 22 } },
      ],
      detectedCategories: [
        { category: "PAYMENT", confidence: 0.8 },
        { category: "HR", confidence: 0.75 },
      ],
      containsSpecialCategorySuspected: false,
    },
  });

  // CopilotSummary (LOCATION_OVERVIEW)
  await prisma.copilotSummary.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      createdByUserId: caseManager.id,
      summaryType: CopilotSummaryType.LOCATION_OVERVIEW,
      content: [
        "## Data Location Overview for John Smith",
        "",
        "**Run completed**: 9 days ago | **Evidence items**: 3 | **Findings**: 3",
        "",
        "### M365 (Entra ID)",
        "- User profile found: display name, email, department (Engineering), job title (Software Developer)",
        "- Data categories: IDENTIFICATION, CONTACT",
        "- Severity: INFO",
        "",
        "### Exchange Online",
        "- 5 emails found in Inbox and Sent Items containing personal identifiers",
        "- 1 attachment (Q4_Compensation_Review.xlsx) containing salary/employment data",
        "- Data categories: COMMUNICATION, CONTACT, HR, PAYMENT",
        "- Severity: WARNING (emails), CRITICAL (HR attachment)",
        "",
        "### Special Category (Art. 9)",
        "No special category data detected.",
        "",
        "*This summary was generated from evidence metadata. No full content was accessed.*",
      ].join("\n"),
      evidenceSnapshotHash: "sha256:demo-snapshot-hash-case1-run1",
      disclaimerIncluded: true,
    },
  });

  // ExportArtifact (JSON export, ALLOWED)
  await prisma.exportArtifact.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      exportType: ExportType.JSON,
      status: "COMPLETED",
      legalGateStatus: ExportLegalGateStatus.ALLOWED,
      createdByUserId: caseManager.id,
    },
  });

  console.log("Created copilot demo data (1 run, 2 queries, 3 evidence items, 3 findings, 3 detector results, 1 identity profile, 1 summary, 1 export artifact)");

  // ── Deadline & Risk Engine Seed Data ──────────────────────────────────

  // Tenant SLA Config
  await prisma.tenantSlaConfig.create({
    data: {
      tenantId: tenant.id,
      initialDeadlineDays: 30,
      extensionMaxDays: 60,
      useBusinessDays: false,
      timezone: "Europe/Berlin",
      yellowThresholdDays: 14,
      redThresholdDays: 7,
      milestoneIdvDays: 7,
      milestoneCollectionDays: 14,
      milestoneDraftDays: 21,
      milestoneLegalDays: 25,
      escalationYellowRoles: ["DPO", "CASE_MANAGER"],
      escalationRedRoles: ["DPO", "TENANT_ADMIN"],
      escalationOverdueRoles: ["DPO", "TENANT_ADMIN", "SUPER_ADMIN"],
    },
  });
  console.log("Created tenant SLA config");

  // Holidays (German public holidays 2026)
  await prisma.holiday.createMany({
    data: [
      { tenantId: tenant.id, date: new Date("2026-01-01"), name: "New Year's Day", locale: "DE" },
      { tenantId: tenant.id, date: new Date("2026-04-03"), name: "Good Friday", locale: "DE" },
      { tenantId: tenant.id, date: new Date("2026-04-06"), name: "Easter Monday", locale: "DE" },
      { tenantId: tenant.id, date: new Date("2026-05-01"), name: "Labour Day", locale: "DE" },
      { tenantId: tenant.id, date: new Date("2026-05-14"), name: "Ascension Day", locale: "DE" },
      { tenantId: tenant.id, date: new Date("2026-05-25"), name: "Whit Monday", locale: "DE" },
      { tenantId: tenant.id, date: new Date("2026-10-03"), name: "German Unity Day", locale: "DE" },
      { tenantId: tenant.id, date: new Date("2026-12-25"), name: "Christmas Day", locale: "DE" },
      { tenantId: tenant.id, date: new Date("2026-12-26"), name: "St. Stephen's Day", locale: "DE" },
    ],
  });
  console.log("Created 9 holidays");

  // CaseDeadlines for each open case with varied risk scenarios
  // Case 1: DATA_COLLECTION, 15d remaining → GREEN risk
  const deadline1 = await prisma.caseDeadline.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      receivedAt: daysAgo(15),
      legalDueAt: daysFromNow(15),
      effectiveDueAt: daysFromNow(15),
      currentRisk: RiskLevel.GREEN,
      riskReasons: [],
      daysRemaining: 15,
    },
  });

  // Case 2: REVIEW_LEGAL, 5d remaining → RED risk (critical)
  const deadline2 = await prisma.caseDeadline.create({
    data: {
      tenantId: tenant.id,
      caseId: case2.id,
      receivedAt: daysAgo(25),
      legalDueAt: daysFromNow(5),
      effectiveDueAt: daysFromNow(5),
      currentRisk: RiskLevel.RED,
      riskReasons: ["Only 5 days remaining", "Legal review still pending"],
      daysRemaining: 5,
    },
  });

  // Case 3: NEW, 28d remaining → GREEN risk
  const deadline3 = await prisma.caseDeadline.create({
    data: {
      tenantId: tenant.id,
      caseId: case3.id,
      receivedAt: daysAgo(2),
      legalDueAt: daysFromNow(28),
      effectiveDueAt: daysFromNow(28),
      currentRisk: RiskLevel.GREEN,
      riskReasons: [],
      daysRemaining: 28,
    },
  });

  // Case 4: RESPONSE_SENT, 2d remaining → YELLOW risk
  const deadline4 = await prisma.caseDeadline.create({
    data: {
      tenantId: tenant.id,
      caseId: case4.id,
      receivedAt: daysAgo(28),
      legalDueAt: daysFromNow(2),
      effectiveDueAt: daysFromNow(2),
      currentRisk: RiskLevel.YELLOW,
      riskReasons: ["Response sent but case not yet closed"],
      daysRemaining: 2,
    },
  });

  // Case 5: REJECTED/CLOSED, overdue → still tracked
  const deadline5 = await prisma.caseDeadline.create({
    data: {
      tenantId: tenant.id,
      caseId: case5.id,
      receivedAt: daysAgo(40),
      legalDueAt: daysAgo(10),
      effectiveDueAt: daysAgo(10),
      currentRisk: RiskLevel.GREEN,
      riskReasons: [],
      daysRemaining: 0,
    },
  });

  console.log("Created 5 case deadlines");

  // Milestones for cases with varied completion states
  const milestoneData = [
    // Case 1: IDV done, collection in progress
    { tenantId: tenant.id, caseId: case1.id, milestoneType: MilestoneType.IDV_COMPLETE, plannedDueAt: daysAgo(8), completedAt: daysAgo(12) },
    { tenantId: tenant.id, caseId: case1.id, milestoneType: MilestoneType.COLLECTION_COMPLETE, plannedDueAt: daysAgo(1), completedAt: null },
    { tenantId: tenant.id, caseId: case1.id, milestoneType: MilestoneType.DRAFT_READY, plannedDueAt: daysFromNow(6), completedAt: null },
    { tenantId: tenant.id, caseId: case1.id, milestoneType: MilestoneType.LEGAL_REVIEW_DONE, plannedDueAt: daysFromNow(10), completedAt: null },
    { tenantId: tenant.id, caseId: case1.id, milestoneType: MilestoneType.RESPONSE_SENT, plannedDueAt: daysFromNow(15), completedAt: null },
    // Case 2: Most milestones done, but legal review overdue
    { tenantId: tenant.id, caseId: case2.id, milestoneType: MilestoneType.IDV_COMPLETE, plannedDueAt: daysAgo(18), completedAt: daysAgo(22) },
    { tenantId: tenant.id, caseId: case2.id, milestoneType: MilestoneType.COLLECTION_COMPLETE, plannedDueAt: daysAgo(11), completedAt: daysAgo(10) },
    { tenantId: tenant.id, caseId: case2.id, milestoneType: MilestoneType.DRAFT_READY, plannedDueAt: daysAgo(4), completedAt: null },
    { tenantId: tenant.id, caseId: case2.id, milestoneType: MilestoneType.LEGAL_REVIEW_DONE, plannedDueAt: daysAgo(0), completedAt: null },
    { tenantId: tenant.id, caseId: case2.id, milestoneType: MilestoneType.RESPONSE_SENT, plannedDueAt: daysFromNow(5), completedAt: null },
    // Case 3: No milestones done yet (NEW)
    { tenantId: tenant.id, caseId: case3.id, milestoneType: MilestoneType.IDV_COMPLETE, plannedDueAt: daysFromNow(5), completedAt: null },
    { tenantId: tenant.id, caseId: case3.id, milestoneType: MilestoneType.COLLECTION_COMPLETE, plannedDueAt: daysFromNow(12), completedAt: null },
    { tenantId: tenant.id, caseId: case3.id, milestoneType: MilestoneType.DRAFT_READY, plannedDueAt: daysFromNow(19), completedAt: null },
    { tenantId: tenant.id, caseId: case3.id, milestoneType: MilestoneType.LEGAL_REVIEW_DONE, plannedDueAt: daysFromNow(23), completedAt: null },
    { tenantId: tenant.id, caseId: case3.id, milestoneType: MilestoneType.RESPONSE_SENT, plannedDueAt: daysFromNow(28), completedAt: null },
  ];
  await prisma.caseMilestone.createMany({ data: milestoneData });
  console.log("Created 15 milestones");

  // Deadline Events
  await prisma.deadlineEvent.createMany({
    data: [
      { tenantId: tenant.id, caseId: case1.id, eventType: DeadlineEventType.CREATED, description: "Deadline tracking initialized. Legal due: 30 calendar days.", actorUserId: admin.id },
      { tenantId: tenant.id, caseId: case1.id, eventType: DeadlineEventType.MILESTONE_COMPLETED, description: "Identity Verification completed.", actorUserId: admin.id },
      { tenantId: tenant.id, caseId: case2.id, eventType: DeadlineEventType.CREATED, description: "Deadline tracking initialized. Legal due: 30 calendar days.", actorUserId: caseManager.id },
      { tenantId: tenant.id, caseId: case2.id, eventType: DeadlineEventType.MILESTONE_COMPLETED, description: "Identity Verification completed.", actorUserId: caseManager.id },
      { tenantId: tenant.id, caseId: case2.id, eventType: DeadlineEventType.MILESTONE_COMPLETED, description: "Data Collection completed.", actorUserId: caseManager.id },
      { tenantId: tenant.id, caseId: case2.id, eventType: DeadlineEventType.RECALCULATED, description: "Risk escalated to RED. Only 5 days remaining.", actorUserId: null },
      { tenantId: tenant.id, caseId: case3.id, eventType: DeadlineEventType.CREATED, description: "Deadline tracking initialized. Legal due: 30 calendar days.", actorUserId: admin.id },
    ],
  });
  console.log("Created deadline events");

  // Escalations
  await prisma.escalation.createMany({
    data: [
      {
        tenantId: tenant.id,
        caseId: case2.id,
        severity: EscalationSeverity.RED_ALERT,
        reason: "Case DSAR-2026-D4E5F6 has only 5 days remaining. Legal review still pending.",
        recipientRoles: ["DPO", "TENANT_ADMIN"],
        acknowledged: false,
        createdByUserId: null,
      },
      {
        tenantId: tenant.id,
        caseId: case2.id,
        severity: EscalationSeverity.YELLOW_WARNING,
        reason: "Case DSAR-2026-D4E5F6 entered yellow zone (< 14 days remaining). Draft response not yet ready.",
        recipientRoles: ["DPO", "CASE_MANAGER"],
        acknowledged: true,
        acknowledgedAt: daysAgo(5),
        createdByUserId: null,
      },
    ],
  });
  console.log("Created escalations");

  // Notifications
  await prisma.notification.createMany({
    data: [
      {
        tenantId: tenant.id,
        recipientUserId: dpo.id,
        type: NotificationType.ESCALATION,
        title: "RED ALERT: DSAR-2026-D4E5F6",
        message: "Case has only 5 days remaining and legal review is still pending. Immediate action required.",
        linkUrl: `/cases/${case2.id}?tab=deadlines`,
        read: false,
      },
      {
        tenantId: tenant.id,
        recipientUserId: admin.id,
        type: NotificationType.ESCALATION,
        title: "RED ALERT: DSAR-2026-D4E5F6",
        message: "Case has only 5 days remaining and legal review is still pending. Immediate action required.",
        linkUrl: `/cases/${case2.id}?tab=deadlines`,
        read: false,
      },
      {
        tenantId: tenant.id,
        recipientUserId: dpo.id,
        type: NotificationType.DEADLINE_WARNING,
        title: "Yellow Warning: DSAR-2026-D4E5F6",
        message: "Case entered yellow risk zone. Less than 14 days remaining.",
        linkUrl: `/cases/${case2.id}?tab=deadlines`,
        read: true,
      },
      {
        tenantId: tenant.id,
        recipientUserId: caseManager.id,
        type: NotificationType.MILESTONE_DUE,
        title: "Milestone overdue: Data Collection",
        message: "Data Collection milestone for DSAR-2026-A1B2C3 is past its planned date.",
        linkUrl: `/cases/${case1.id}?tab=deadlines`,
        read: false,
      },
      {
        tenantId: tenant.id,
        recipientUserId: caseManager.id,
        type: NotificationType.INFO,
        title: "Deadline initialized: DSAR-2026-G7H8I9",
        message: "Deadline tracking has been set up for the new rectification request. Due in 28 days.",
        linkUrl: `/cases/${case3.id}?tab=deadlines`,
        read: true,
      },
    ],
  });
  console.log("Created notifications");

  // ── Identity Verification Seed Data ────────────────────────────────────

  // IDV Settings (default config)
  await prisma.idvSettings.create({
    data: {
      tenantId: tenant.id,
      allowedMethods: [IdvMethod.DOC_UPLOAD, IdvMethod.EMAIL_OTP],
      selfieEnabled: false,
      knowledgeBasedEnabled: false,
      emailOtpEnabled: true,
      retentionDays: 90,
      portalTokenExpiryDays: 7,
      maxSubmissionsPerToken: 3,
      bypassForSsoEmail: false,
      bypassForRepeatRequester: false,
      repeatRequesterMonths: 6,
      autoTransitionOnApproval: false,
      storeDob: true,
    },
  });
  console.log("Created IDV settings");

  // Case 1: Approved IDV (DATA_COLLECTION status)
  const idvReq1 = await prisma.idvRequest.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      dataSubjectId: case1.dataSubjectId,
      status: IdvRequestStatus.APPROVED,
      allowedMethods: [IdvMethod.DOC_UPLOAD],
      submittedAt: daysAgo(13),
      submissionCount: 1,
      maxSubmissions: 3,
    },
  });

  // Mock artifact for case 1 (approved)
  await prisma.idvArtifact.create({
    data: {
      tenantId: tenant.id,
      requestId: idvReq1.id,
      artifactType: IdvArtifactType.PASSPORT,
      filename: "passport_scan.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 245_000,
      sha256Hash: "a1b2c3d4e5f6789012345678abcdef01234567890abcdef0123456789abcdef",
      storageKey: "mock-passport-1.jpg",
      consentGiven: true,
      retainUntil: daysFromNow(77),
    },
  });

  await prisma.idvCheck.create({
    data: {
      tenantId: tenant.id,
      requestId: idvReq1.id,
      method: IdvMethod.DOC_UPLOAD,
      passed: true,
      details: { artifactCount: 1, artifactTypes: ["PASSPORT"] } as any,
    },
  });

  await prisma.idvRiskAssessment.create({
    data: {
      tenantId: tenant.id,
      requestId: idvReq1.id,
      riskScore: 10,
      flags: [{ flag: "SELFIE_NOT_PROVIDED", severity: "low", detail: "No selfie submitted (not required)" }] as any,
      extractedFields: { name: "Max Mustermann", dob: "1985-03-15", documentType: "PASSPORT", issuingCountry: "DE" } as any,
      mismatches: [] as any,
      provider: "mock",
    },
  });

  await prisma.idvDecision.create({
    data: {
      tenantId: tenant.id,
      requestId: idvReq1.id,
      outcome: IdvDecisionOutcome.APPROVED,
      rationale: "Passport matches subject details. Low risk score. Identity verified.",
      reviewerUserId: dpo.id,
    },
  });
  console.log("Created IDV scenario 1: Approved verification");

  // Case 2: Need more info IDV (REVIEW_LEGAL status)
  const idvReq2 = await prisma.idvRequest.create({
    data: {
      tenantId: tenant.id,
      caseId: case2.id,
      dataSubjectId: case2.dataSubjectId,
      status: IdvRequestStatus.NEED_MORE_INFO,
      allowedMethods: [IdvMethod.DOC_UPLOAD, IdvMethod.UTILITY_BILL],
      submittedAt: daysAgo(20),
      submissionCount: 1,
      maxSubmissions: 3,
    },
  });

  await prisma.idvArtifact.create({
    data: {
      tenantId: tenant.id,
      requestId: idvReq2.id,
      artifactType: IdvArtifactType.ID_FRONT,
      filename: "id_card_front.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 180_000,
      sha256Hash: "b2c3d4e5f6789012345678abcdef01234567890abcdef0123456789abcdef01",
      storageKey: "mock-id-front-2.jpg",
      consentGiven: true,
      retainUntil: daysFromNow(70),
    },
  });

  await prisma.idvRiskAssessment.create({
    data: {
      tenantId: tenant.id,
      requestId: idvReq2.id,
      riskScore: 45,
      flags: [
        { flag: "MISSING_ID_BACK", severity: "medium", detail: "ID card front provided but back is missing" },
        { flag: "NAME_PARTIAL_MATCH", severity: "low", detail: "Extracted name partially matches request" },
      ] as any,
      extractedFields: { name: "E. Schmidt", dob: "1992-07-22", documentType: "ID_CARD", issuingCountry: "DE" } as any,
      mismatches: [{ field: "name", expected: "Eva Schmidt", extracted: "E. Schmidt", severity: "low" }] as any,
      provider: "mock",
    },
  });

  await prisma.idvDecision.create({
    data: {
      tenantId: tenant.id,
      requestId: idvReq2.id,
      outcome: IdvDecisionOutcome.NEED_MORE_INFO,
      rationale: "ID card back is missing. Please request the subject to upload both sides of their ID.",
      reviewerUserId: dpo.id,
    },
  });
  console.log("Created IDV scenario 2: Need more info");

  // Case 3: High-risk flagged IDV (NEW status)
  const idvReq3 = await prisma.idvRequest.create({
    data: {
      tenantId: tenant.id,
      caseId: case3.id,
      dataSubjectId: case3.dataSubjectId,
      status: IdvRequestStatus.IN_REVIEW,
      allowedMethods: [IdvMethod.DOC_UPLOAD],
      submittedAt: daysAgo(1),
      submissionCount: 1,
      maxSubmissions: 3,
    },
  });

  await prisma.idvArtifact.createMany({
    data: [
      {
        tenantId: tenant.id,
        requestId: idvReq3.id,
        artifactType: IdvArtifactType.DRIVERS_LICENSE,
        filename: "drivers_license_scan.pdf",
        mimeType: "application/pdf",
        sizeBytes: 35_000,
        sha256Hash: "c3d4e5f6789012345678abcdef01234567890abcdef0123456789abcdef0123",
        storageKey: "mock-license-3.pdf",
        consentGiven: true,
        retainUntil: daysFromNow(89),
      },
      {
        tenantId: tenant.id,
        requestId: idvReq3.id,
        artifactType: IdvArtifactType.UTILITY_BILL,
        filename: "electricity_bill.pdf",
        mimeType: "application/pdf",
        sizeBytes: 28_000,
        sha256Hash: "d4e5f6789012345678abcdef01234567890abcdef0123456789abcdef012345",
        storageKey: "mock-bill-3.pdf",
        consentGiven: true,
        retainUntil: daysFromNow(89),
      },
    ],
  });

  await prisma.idvRiskAssessment.create({
    data: {
      tenantId: tenant.id,
      requestId: idvReq3.id,
      riskScore: 72,
      flags: [
        { flag: "LOW_QUALITY_DOCUMENT", severity: "medium", detail: "drivers_license_scan.pdf may be low quality (34KB)" },
        { flag: "EXPIRED_DOCUMENT", severity: "high", detail: "ID document appears to have expired on 2025-08-15" },
        { flag: "ADDRESS_MISMATCH", severity: "medium", detail: "Address on utility bill does not match the provided address" },
      ] as any,
      extractedFields: { name: "Thomas Weber", dob: "1988-11-03", documentType: "DRIVERS_LICENSE", expiryDate: "2025-08-15", issuingCountry: "DE" } as any,
      mismatches: [
        { field: "address", expected: "Friedrichstr. 100, Berlin", extracted: "123 Different Street, Berlin 10115", severity: "medium" },
      ] as any,
      provider: "mock",
    },
  });
  console.log("Created IDV scenario 3: High-risk flagged");

  console.log("\n--- Seed Complete ---");
  console.log("Tenant: Acme Corp");
  console.log("Users:");
  console.log("  daniel.schormann@gmail.com (TENANT_ADMIN) - password: admin123");
  console.log("  admin@acme-corp.com    (TENANT_ADMIN) - password: admin123456");
  console.log("  dpo@acme-corp.com      (DPO) - password: admin123456");
  console.log("  manager@acme-corp.com  (CASE_MANAGER) - password: admin123456");
  console.log("  contributor@acme-corp.com (CONTRIBUTOR) - password: admin123456");
  console.log("  viewer@acme-corp.com   (READ_ONLY) - password: admin123456");
  console.log(`Cases: 5 (various statuses)`);
  console.log(`Systems: 4`);
  console.log(`Integrations: 5 (M365/Exchange/SharePoint/OneDrive enabled, Salesforce disabled)`);
  console.log(`Communication Logs: 7`);
  console.log(`Data Collection Items: 9`);
  console.log(`Legal Reviews: 3`);
  console.log(`Copilot Runs: 1 (COMPLETED, 3 findings, 3 evidence items)`);
  console.log(`Copilot Queries: 2 (M365, Exchange)`);
  console.log(`Evidence Items: 3 (1 record, 1 email batch, 1 file)`);
  console.log(`Findings: 3 (with 3 detector results)`);
  console.log(`Identity Profiles: 1`);
  console.log(`Copilot Summaries: 1 (LOCATION_OVERVIEW)`);
  console.log(`Export Artifacts: 1 (JSON, ALLOWED)`);

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE 4: Response Generator — Default Templates + Demo Data
  // ═══════════════════════════════════════════════════════════════════════

  console.log("\n--- MODULE 4: Response Generator ---");

  // ── Default Baseline Templates ─────────────────────────────────────────

  const art15TemplateEn = await prisma.responseTemplate.create({
    data: {
      tenantId: null, // system baseline
      name: "Art. 15 Access Response (EN)",
      language: "en",
      jurisdiction: "GDPR",
      dsarTypes: [DSARType.ACCESS],
      isBaseline: true,
      disclaimerText: "This response has been generated from a template and reviewed case data. It does not constitute legal advice. Please have this document reviewed by your Data Protection Officer or legal counsel before sending to the data subject.",
      sections: [
        { key: "intro", title: "Introduction", body: "<p>Dear {{subject.name}},</p><p>We refer to your data subject access request received on <strong>{{case.received_date}}</strong> (Reference: <strong>{{case.number}}</strong>). In accordance with Article 15 of the General Data Protection Regulation (GDPR), we have processed your request and provide the following information.</p>" },
        { key: "identity", title: "Identity Verification", body: "<p>Your identity has been <strong>{{idv.status}}</strong> as required under Article 12(6) GDPR prior to processing your request.</p>" },
        { key: "scope", title: "Scope of Processing", body: "<p>Following a thorough search of our systems, we can confirm that we process your personal data across <strong>{{systems.count}}</strong> system(s): {{systems.names}}.</p>" },
        { key: "categories", title: "Categories of Personal Data", body: "<p>The categories of personal data we process about you include: <strong>{{data.categories}}</strong>.</p><p>A total of <strong>{{data.total_records}}</strong> records were identified across our systems.</p>" },
        { key: "purposes", title: "Purposes and Legal Basis", body: "<p>We process your personal data for the following purposes and legal bases: <strong>{{legal.lawful_basis}}</strong>.</p>" },
        { key: "recipients", title: "Recipients", body: "<p>Your personal data has been shared with or may be accessible to the following categories of recipients: <strong>{{recipients.categories}}</strong>.</p>" },
        { key: "retention", title: "Retention Periods", body: "<p>We retain your personal data in accordance with our data retention policy: <strong>{{retention.summary}}</strong>.</p>" },
        { key: "data_copy", title: "Copy of Your Data", body: "<p>Please find attached a copy of the personal data we hold about you. The data has been provided in a structured, commonly used format.</p>" },
        { key: "exemptions", title: "Exemptions Applied", body: "<p>Exemptions applied: <strong>{{legal.exemptions}}</strong>.</p>" },
        { key: "rights", title: "Your Rights", body: "<p>Under the GDPR, you have additional rights including the right to rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20), and the right to object (Art. 21). You also have the right to lodge a complaint with your local supervisory authority.</p>" },
        { key: "contact", title: "Contact", body: "<p>If you have any questions regarding this response, please contact our Data Protection Officer at <strong>{{tenant.name}}</strong>.</p><p>Yours sincerely,<br/>Data Protection Office<br/>{{tenant.name}}</p>" },
      ],
      conditionals: [
        { condition: "extensionUsed", sectionKey: "extension", show: true },
      ],
      placeholders: [
        { key: "subject.name", label: "Subject Name", description: "Full name of the data subject" },
        { key: "case.number", label: "Case Reference", description: "DSAR case number" },
        { key: "case.received_date", label: "Received Date", description: "Date the request was received" },
        { key: "systems.count", label: "System Count", description: "Number of systems searched" },
        { key: "data.categories", label: "Data Categories", description: "Categories of personal data found" },
      ],
    },
  });

  await prisma.responseTemplateVersion.create({
    data: { templateId: art15TemplateEn.id, version: 1, sections: art15TemplateEn.sections as any, changeNote: "Initial baseline version" },
  });

  const art15TemplateDe = await prisma.responseTemplate.create({
    data: {
      tenantId: null,
      name: "Art. 15 Auskunftsantwort (DE)",
      language: "de",
      jurisdiction: "GDPR",
      dsarTypes: [DSARType.ACCESS],
      isBaseline: true,
      disclaimerText: "Diese Antwort wurde aus einer Vorlage und Falldaten generiert. Sie stellt keine Rechtsberatung dar. Bitte lassen Sie dieses Dokument von Ihrem Datenschutzbeauftragten oder Rechtsberater prüfen, bevor Sie es an die betroffene Person senden.",
      sections: [
        { key: "intro", title: "Einleitung", body: "<p>Sehr geehrte/r {{subject.name}},</p><p>wir beziehen uns auf Ihren Auskunftsantrag gemäß Art. 15 DSGVO, eingegangen am <strong>{{case.received_date}}</strong> (Referenz: <strong>{{case.number}}</strong>). Wir haben Ihren Antrag bearbeitet und teilen Ihnen Folgendes mit.</p>" },
        { key: "identity", title: "Identitätsprüfung", body: "<p>Ihre Identität wurde gemäß Art. 12 Abs. 6 DSGVO <strong>{{idv.status}}</strong>.</p>" },
        { key: "scope", title: "Umfang der Verarbeitung", body: "<p>Wir verarbeiten Ihre personenbezogenen Daten in <strong>{{systems.count}}</strong> System(en): {{systems.names}}.</p>" },
        { key: "categories", title: "Kategorien personenbezogener Daten", body: "<p>Folgende Kategorien personenbezogener Daten werden verarbeitet: <strong>{{data.categories}}</strong>.</p><p>Insgesamt wurden <strong>{{data.total_records}}</strong> Datensätze identifiziert.</p>" },
        { key: "purposes", title: "Zwecke und Rechtsgrundlage", body: "<p>Rechtsgrundlage: <strong>{{legal.lawful_basis}}</strong>.</p>" },
        { key: "recipients", title: "Empfänger", body: "<p>Ihre Daten wurden an folgende Empfängerkategorien übermittelt: <strong>{{recipients.categories}}</strong>.</p>" },
        { key: "retention", title: "Speicherdauer", body: "<p>Speicherfristen: <strong>{{retention.summary}}</strong>.</p>" },
        { key: "rights", title: "Ihre Rechte", body: "<p>Gemäß DSGVO haben Sie weitere Rechte: Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21). Sie können sich auch bei Ihrer zuständigen Aufsichtsbehörde beschweren.</p>" },
        { key: "contact", title: "Kontakt", body: "<p>Bei Fragen wenden Sie sich bitte an unseren Datenschutzbeauftragten bei <strong>{{tenant.name}}</strong>.</p><p>Mit freundlichen Grüßen,<br/>Datenschutzabteilung<br/>{{tenant.name}}</p>" },
      ],
    },
  });
  await prisma.responseTemplateVersion.create({
    data: { templateId: art15TemplateDe.id, version: 1, sections: art15TemplateDe.sections as any, changeNote: "Initial baseline version" },
  });

  const art17TemplateEn = await prisma.responseTemplate.create({
    data: {
      tenantId: null,
      name: "Art. 17 Erasure Response (EN)",
      language: "en",
      jurisdiction: "GDPR",
      dsarTypes: [DSARType.ERASURE],
      isBaseline: true,
      disclaimerText: "This response has been generated from a template. It does not constitute legal advice.",
      sections: [
        { key: "intro", title: "Introduction", body: "<p>Dear {{subject.name}},</p><p>We refer to your erasure request received on <strong>{{case.received_date}}</strong> (Reference: <strong>{{case.number}}</strong>). We have assessed your request under Article 17 GDPR.</p>" },
        { key: "decision", title: "Our Decision", body: "<p>After careful review, we have processed your erasure request across <strong>{{systems.count}}</strong> system(s).</p>" },
        { key: "scope", title: "Systems Affected", body: "<p>Systems: {{systems.names}}.</p><p>Data categories erased: <strong>{{data.categories}}</strong>.</p>" },
        { key: "exemptions", title: "Exemptions", body: "<p>The following exemptions under Art. 17(3) were applied where applicable: <strong>{{legal.exemptions}}</strong>.</p>" },
        { key: "rights", title: "Your Rights", body: "<p>If you disagree with our decision, you have the right to lodge a complaint with the competent supervisory authority.</p>" },
        { key: "contact", title: "Contact", body: "<p>For questions, please contact our Data Protection Officer at <strong>{{tenant.name}}</strong>.</p>" },
      ],
    },
  });
  await prisma.responseTemplateVersion.create({
    data: { templateId: art17TemplateEn.id, version: 1, sections: art17TemplateEn.sections as any, changeNote: "Initial baseline version" },
  });

  const art17TemplateDe = await prisma.responseTemplate.create({
    data: {
      tenantId: null,
      name: "Art. 17 Löschungsantwort (DE)",
      language: "de",
      jurisdiction: "GDPR",
      dsarTypes: [DSARType.ERASURE],
      isBaseline: true,
      disclaimerText: "Diese Antwort wurde aus einer Vorlage generiert und stellt keine Rechtsberatung dar.",
      sections: [
        { key: "intro", title: "Einleitung", body: "<p>Sehr geehrte/r {{subject.name}},</p><p>wir beziehen uns auf Ihren Löschungsantrag gemäß Art. 17 DSGVO vom <strong>{{case.received_date}}</strong> (Referenz: <strong>{{case.number}}</strong>).</p>" },
        { key: "decision", title: "Unsere Entscheidung", body: "<p>Nach sorgfältiger Prüfung haben wir Ihren Löschungsantrag in <strong>{{systems.count}}</strong> System(en) bearbeitet.</p>" },
        { key: "exemptions", title: "Ausnahmen", body: "<p>Angewandte Ausnahmen gemäß Art. 17 Abs. 3: <strong>{{legal.exemptions}}</strong>.</p>" },
        { key: "rights", title: "Ihre Rechte", body: "<p>Sie haben das Recht, Beschwerde bei der zuständigen Aufsichtsbehörde einzulegen.</p>" },
        { key: "contact", title: "Kontakt", body: "<p>Bei Fragen wenden Sie sich an unseren Datenschutzbeauftragten bei <strong>{{tenant.name}}</strong>.</p>" },
      ],
    },
  });
  await prisma.responseTemplateVersion.create({
    data: { templateId: art17TemplateDe.id, version: 1, sections: art17TemplateDe.sections as any, changeNote: "Initial baseline version" },
  });

  const art16TemplateEn = await prisma.responseTemplate.create({
    data: {
      tenantId: null,
      name: "Art. 16 Rectification Response (EN)",
      language: "en",
      jurisdiction: "GDPR",
      dsarTypes: [DSARType.RECTIFICATION],
      isBaseline: true,
      sections: [
        { key: "intro", title: "Introduction", body: "<p>Dear {{subject.name}},</p><p>We refer to your rectification request received on <strong>{{case.received_date}}</strong> (Reference: <strong>{{case.number}}</strong>).</p>" },
        { key: "changes", title: "Changes Made", body: "<p>We have updated your personal data in <strong>{{systems.count}}</strong> system(s) as requested.</p>" },
        { key: "contact", title: "Contact", body: "<p>For questions, please contact our Data Protection Officer at <strong>{{tenant.name}}</strong>.</p>" },
      ],
    },
  });
  await prisma.responseTemplateVersion.create({
    data: { templateId: art16TemplateEn.id, version: 1, sections: art16TemplateEn.sections as any, changeNote: "Initial baseline version" },
  });

  const art16TemplateDe = await prisma.responseTemplate.create({
    data: {
      tenantId: null,
      name: "Art. 16 Berichtigungsantwort (DE)",
      language: "de",
      jurisdiction: "GDPR",
      dsarTypes: [DSARType.RECTIFICATION],
      isBaseline: true,
      sections: [
        { key: "intro", title: "Einleitung", body: "<p>Sehr geehrte/r {{subject.name}},</p><p>wir beziehen uns auf Ihren Berichtigungsantrag vom <strong>{{case.received_date}}</strong> (Referenz: <strong>{{case.number}}</strong>).</p>" },
        { key: "changes", title: "Vorgenommene Änderungen", body: "<p>Wir haben Ihre Daten in <strong>{{systems.count}}</strong> System(en) korrigiert.</p>" },
        { key: "contact", title: "Kontakt", body: "<p>Bei Fragen wenden Sie sich an unseren Datenschutzbeauftragten bei <strong>{{tenant.name}}</strong>.</p>" },
      ],
    },
  });
  await prisma.responseTemplateVersion.create({
    data: { templateId: art16TemplateDe.id, version: 1, sections: art16TemplateDe.sections as any, changeNote: "Initial baseline version" },
  });

  const art12ExtensionEn = await prisma.responseTemplate.create({
    data: {
      tenantId: null,
      name: "Art. 12 Extension Notice (EN)",
      language: "en",
      jurisdiction: "GDPR",
      dsarTypes: [DSARType.ACCESS, DSARType.ERASURE, DSARType.RECTIFICATION, DSARType.RESTRICTION, DSARType.PORTABILITY, DSARType.OBJECTION],
      isBaseline: true,
      sections: [
        { key: "intro", title: "Extension Notice", body: "<p>Dear {{subject.name}},</p><p>We refer to your request received on <strong>{{case.received_date}}</strong> (Reference: <strong>{{case.number}}</strong>).</p><p>In accordance with Article 12(3) GDPR, we wish to inform you that due to the complexity of your request, we require an extension of the response deadline.</p>" },
        { key: "reason", title: "Reason for Extension", body: "<p>Reason: <strong>{{deadlines.extension_reason}}</strong>.</p><p>The new deadline for our response is <strong>{{deadlines.effective_due_date}}</strong>.</p>" },
        { key: "rights", title: "Your Rights", body: "<p>You retain all your rights under the GDPR, including the right to lodge a complaint with the supervisory authority.</p>" },
        { key: "contact", title: "Contact", body: "<p>For questions, please contact <strong>{{tenant.name}}</strong>.</p>" },
      ],
    },
  });
  await prisma.responseTemplateVersion.create({
    data: { templateId: art12ExtensionEn.id, version: 1, sections: art12ExtensionEn.sections as any, changeNote: "Initial baseline version" },
  });

  const art12ExtensionDe = await prisma.responseTemplate.create({
    data: {
      tenantId: null,
      name: "Art. 12 Fristverlängerung (DE)",
      language: "de",
      jurisdiction: "GDPR",
      dsarTypes: [DSARType.ACCESS, DSARType.ERASURE, DSARType.RECTIFICATION, DSARType.RESTRICTION, DSARType.PORTABILITY, DSARType.OBJECTION],
      isBaseline: true,
      sections: [
        { key: "intro", title: "Fristverlängerung", body: "<p>Sehr geehrte/r {{subject.name}},</p><p>wir beziehen uns auf Ihren Antrag vom <strong>{{case.received_date}}</strong> (Referenz: <strong>{{case.number}}</strong>).</p><p>Gemäß Art. 12 Abs. 3 DSGVO benötigen wir aufgrund der Komplexität Ihres Antrags eine Fristverlängerung.</p>" },
        { key: "reason", title: "Begründung", body: "<p>Grund: <strong>{{deadlines.extension_reason}}</strong>.</p><p>Die neue Frist ist <strong>{{deadlines.effective_due_date}}</strong>.</p>" },
        { key: "contact", title: "Kontakt", body: "<p>Bei Fragen wenden Sie sich an <strong>{{tenant.name}}</strong>.</p>" },
      ],
    },
  });
  await prisma.responseTemplateVersion.create({
    data: { templateId: art12ExtensionDe.id, version: 1, sections: art12ExtensionDe.sections as any, changeNote: "Initial baseline version" },
  });

  console.log("Created 10 baseline response templates (EN + DE)");

  // ── Demo Response Documents ────────────────────────────────────────────

  // Case 1 (ACCESS): Draft response in review
  const responseDoc1 = await prisma.responseDocument.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      templateId: art15TemplateEn.id,
      version: 1,
      status: ResponseDocStatus.IN_REVIEW,
      language: "en",
      sections: [
        { key: "intro", title: "Introduction", renderedHtml: `<p>Dear John Smith,</p><p>We refer to your data subject access request received on ${new Date(daysAgo(15)).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} (Reference: <strong>DSAR-2026-A1B2C3</strong>). In accordance with Article 15 GDPR, we provide the following information.</p>` },
        { key: "scope", title: "Scope", renderedHtml: "<p>We searched 4 systems: SAP CRM, Microsoft 365, Finance Database, Marketing Platform.</p>" },
        { key: "categories", title: "Data Categories", renderedHtml: "<p>Categories: IDENTIFICATION, CONTACT, CONTRACT, PAYMENT, COMMUNICATION. Total records: 156.</p>" },
      ],
      fullHtml: "<html><body><h1>DSAR Response</h1><p>Case DSAR-2026-A1B2C3 — Access request response draft.</p></body></html>",
      createdByUserId: caseManager.id,
    },
  });

  await prisma.responseApproval.create({
    data: {
      tenantId: tenant.id,
      responseDocId: responseDoc1.id,
      reviewerUserId: dpo.id,
      action: "request_changes",
      comments: "Please add retention period details to the data summary section.",
    },
  });

  // Case 2 (ERASURE): Approved and sent
  const responseDoc2 = await prisma.responseDocument.create({
    data: {
      tenantId: tenant.id,
      caseId: case2.id,
      templateId: art17TemplateEn.id,
      version: 1,
      status: ResponseDocStatus.SENT,
      language: "en",
      sections: [
        { key: "intro", title: "Introduction", renderedHtml: "<p>Dear Emma Mueller,</p><p>We refer to your erasure request (DSAR-2026-D4E5F6).</p>" },
        { key: "decision", title: "Decision", renderedHtml: "<p>Your data has been erased from 3 systems. Exemption applied: financial records retained per legal obligation (6 years).</p>" },
      ],
      fullHtml: "<html><body><h1>Erasure Response</h1><p>Partial erasure completed for DSAR-2026-D4E5F6.</p></body></html>",
      approvedByUserId: dpo.id,
      approvedAt: daysAgo(2),
      sentAt: daysAgo(1),
      createdByUserId: dpo.id,
    },
  });

  await prisma.responseApproval.create({
    data: {
      tenantId: tenant.id,
      responseDocId: responseDoc2.id,
      reviewerUserId: admin.id,
      action: "approve",
      comments: "Exemptions correctly documented.",
    },
  });

  await prisma.deliveryRecord.create({
    data: {
      tenantId: tenant.id,
      responseDocId: responseDoc2.id,
      method: DeliveryMethod.EMAIL,
      recipientRef: "emma.mueller@example.com",
      notes: "Sent via encrypted email with PDF attachment.",
      createdByUserId: dpo.id,
      sentAt: daysAgo(1),
    },
  });

  // Case 4 (PORTABILITY): Approved response awaiting send
  await prisma.responseDocument.create({
    data: {
      tenantId: tenant.id,
      caseId: case4.id,
      version: 1,
      status: ResponseDocStatus.APPROVED,
      language: "en",
      sections: [
        { key: "intro", title: "Introduction", renderedHtml: "<p>Dear Max Mustermann,</p><p>We have prepared your data in machine-readable format as requested (DSAR-2026-J0K1L2).</p>" },
      ],
      fullHtml: "<html><body><h1>Portability Response</h1><p>Data export ready for DSAR-2026-J0K1L2.</p></body></html>",
      approvedByUserId: admin.id,
      approvedAt: daysAgo(1),
      createdByUserId: caseManager.id,
    },
  });

  console.log("Created 3 demo response documents (in_review, sent, approved)");
  console.log("Response Generator seed complete.");

  // ─── MODULE 5: Incidents & Authority Linkage ────────────────────────

  // Incident 1: Phishing-led account compromise (MEDIUM, CONTAINED)
  const incident1 = await prisma.incident.create({
    data: {
      tenantId: tenant.id,
      title: "Phishing-led account compromise",
      description: "A targeted phishing campaign led to unauthorized access to the CRM system through compromised employee credentials.",
      severity: IncidentSeverity.MEDIUM,
      status: IncidentStatus.CONTAINED,
      detectedAt: daysAgo(10),
      containedAt: daysAgo(7),
      regulatorNotificationRequired: false,
      numberOfDataSubjectsEstimate: 150,
      categoriesOfDataAffected: ["IDENTIFICATION", "CONTACT", "COMMUNICATION"],
      crossBorder: false,
      createdByUserId: dpo.id,
    },
  });

  // Incident 1 — source
  await prisma.incidentSource.create({
    data: {
      tenantId: tenant.id,
      incidentId: incident1.id,
      sourceType: IncidentSourceType.MANUAL,
    },
  });

  // Incident 1 — affected systems
  await prisma.incidentSystem.createMany({
    data: [
      { tenantId: tenant.id, incidentId: incident1.id, systemId: crmSystem.id, notes: "Primary target — unauthorized CRM access via phished credentials" },
      { tenantId: tenant.id, incidentId: incident1.id, systemId: emailSystem.id, notes: "Phishing emails delivered through this channel" },
    ],
  });

  // Incident 1 — contacts
  await prisma.incidentContact.createMany({
    data: [
      { tenantId: tenant.id, incidentId: incident1.id, role: "DPO", name: "David DPO", email: "dpo@acme-corp.com" },
      { tenantId: tenant.id, incidentId: incident1.id, role: "CISO", name: "Sarah CISO", email: "ciso@acme-corp.com" },
    ],
  });

  // Incident 1 — timeline events
  await prisma.incidentTimeline.createMany({
    data: [
      { tenantId: tenant.id, incidentId: incident1.id, eventType: IncidentTimelineEventType.DETECTED, timestamp: daysAgo(10), description: "Anomalous CRM access patterns detected by SOC monitoring", createdByUserId: dpo.id },
      { tenantId: tenant.id, incidentId: incident1.id, eventType: IncidentTimelineEventType.TRIAGED, timestamp: daysAgo(9), description: "Confirmed phishing vector; affected accounts identified", createdByUserId: dpo.id },
      { tenantId: tenant.id, incidentId: incident1.id, eventType: IncidentTimelineEventType.CONTAINED, timestamp: daysAgo(7), description: "All compromised credentials reset, MFA enforced across organization", createdByUserId: dpo.id },
    ],
  });

  // Incident 1 — assessment
  await prisma.incidentAssessment.create({
    data: {
      tenantId: tenant.id,
      incidentId: incident1.id,
      natureOfBreach: "Phishing attack led to unauthorized access to CRM",
      categoriesAndApproxSubjects: "~150 customers",
      categoriesAndApproxRecords: "~500 records",
      likelyConsequences: "Potential exposure of contact details",
      measuresTakenOrProposed: "Passwords reset, MFA enforced",
      dpoContactDetails: "David DPO, dpo@acme-corp.com",
      version: 1,
      createdByUserId: dpo.id,
    },
  });

  // Incident 1 — link to existing DSAR cases
  await prisma.dsarIncident.createMany({
    data: [
      { tenantId: tenant.id, caseId: case1.id, incidentId: incident1.id, linkReason: "Data subject affected by phishing incident", subjectInScope: DsarIncidentSubjectStatus.YES, linkedByUserId: dpo.id },
      { tenantId: tenant.id, caseId: case2.id, incidentId: incident1.id, linkReason: "Data subject potentially affected — erasure requested during incident window", subjectInScope: DsarIncidentSubjectStatus.YES, linkedByUserId: dpo.id },
    ],
  });

  console.log("Created Incident 1: Phishing-led account compromise (MEDIUM / CONTAINED)");

  // Incident 2: Data exfiltration suspected (HIGH, OPEN)
  const incident2 = await prisma.incident.create({
    data: {
      tenantId: tenant.id,
      title: "Data exfiltration suspected",
      description: "SIEM alerts indicate potential large-scale data exfiltration from HR and finance systems. Investigation ongoing.",
      severity: IncidentSeverity.HIGH,
      status: IncidentStatus.OPEN,
      detectedAt: daysAgo(5),
      regulatorNotificationRequired: true,
      regulatorNotifiedAt: null,
      numberOfDataSubjectsEstimate: 2500,
      categoriesOfDataAffected: ["IDENTIFICATION", "CONTACT", "HR", "PAYMENT"],
      crossBorder: true,
      createdByUserId: admin.id,
    },
  });

  // Incident 2 — source (SIEM import)
  await prisma.incidentSource.create({
    data: {
      tenantId: tenant.id,
      incidentId: incident2.id,
      sourceType: IncidentSourceType.IMPORT_SIEM,
      externalId: "SIEM-2026-4421",
      importedAt: daysAgo(5),
    },
  });

  // Incident 2 — affected systems
  await prisma.incidentSystem.createMany({
    data: [
      { tenantId: tenant.id, incidentId: incident2.id, systemId: hrSystem.id, notes: "Employee PII potentially exfiltrated" },
      { tenantId: tenant.id, incidentId: incident2.id, systemId: financeSystem.id, notes: "Payment and billing data potentially exfiltrated" },
      { tenantId: tenant.id, incidentId: incident2.id, systemId: m365System.id, notes: "Mailbox data accessed by compromised service account" },
    ],
  });

  // Incident 2 — contacts
  await prisma.incidentContact.createMany({
    data: [
      { tenantId: tenant.id, incidentId: incident2.id, role: "DPO", name: "David DPO", email: "dpo@acme-corp.com" },
      { tenantId: tenant.id, incidentId: incident2.id, role: "CISO", name: "Sarah CISO", email: "ciso@acme-corp.com" },
      { tenantId: tenant.id, incidentId: incident2.id, role: "Legal", name: "Legal Team", email: "legal@acme-corp.com" },
      { tenantId: tenant.id, incidentId: incident2.id, role: "Comms", name: "PR Team", email: "comms@acme-corp.com" },
    ],
  });

  // Incident 2 — timeline events
  await prisma.incidentTimeline.createMany({
    data: [
      { tenantId: tenant.id, incidentId: incident2.id, eventType: IncidentTimelineEventType.DETECTED, timestamp: daysAgo(5), description: "SIEM alert SIEM-2026-4421: Unusual outbound data transfer volume detected from HR and finance systems", createdByUserId: admin.id },
      { tenantId: tenant.id, incidentId: incident2.id, eventType: IncidentTimelineEventType.TRIAGED, timestamp: daysAgo(4), description: "Forensic analysis initiated; compromised service account isolated; scope of exfiltration under investigation", createdByUserId: admin.id },
    ],
  });

  // Incident 2 — assessment
  await prisma.incidentAssessment.create({
    data: {
      tenantId: tenant.id,
      incidentId: incident2.id,
      natureOfBreach: "Suspected large-scale data exfiltration via compromised service account affecting HR and finance systems",
      categoriesAndApproxSubjects: "~2,500 employees and customers across EU subsidiaries",
      categoriesAndApproxRecords: "~15,000 records (HR files, payroll data, payment records)",
      likelyConsequences: "Risk of identity fraud, financial loss, and regulatory penalties; cross-border impact across DE, FR, NL offices",
      measuresTakenOrProposed: "Service account disabled, network segmentation applied, forensic imaging in progress, external IR firm engaged",
      dpoContactDetails: "David DPO, dpo@acme-corp.com",
      additionalNotes: "72-hour notification deadline approaching. Legal counsel reviewing preliminary notification draft.",
      version: 1,
      createdByUserId: admin.id,
    },
  });

  // Incident 2 — regulator record (BfDI, draft)
  await prisma.incidentRegulatorRecord.create({
    data: {
      tenantId: tenant.id,
      incidentId: incident2.id,
      authorityName: "BfDI (German Federal Commissioner)",
      country: "DE",
      status: RegulatorRecordStatus.DRAFT,
      notes: "Preliminary notification being prepared. 72-hour deadline from detection.",
    },
  });

  // Incident 2 — link to existing DSAR cases
  await prisma.dsarIncident.createMany({
    data: [
      { tenantId: tenant.id, caseId: case1.id, incidentId: incident2.id, linkReason: "Data subject records found in exfiltrated dataset", subjectInScope: DsarIncidentSubjectStatus.YES, linkedByUserId: dpo.id },
      { tenantId: tenant.id, caseId: case2.id, incidentId: incident2.id, linkReason: "Erasure request overlaps with breached data categories", subjectInScope: DsarIncidentSubjectStatus.YES, linkedByUserId: dpo.id },
      { tenantId: tenant.id, caseId: case3.id, incidentId: incident2.id, linkReason: "Portability request for HR data — system under investigation", subjectInScope: DsarIncidentSubjectStatus.UNKNOWN, linkedByUserId: admin.id },
      { tenantId: tenant.id, caseId: case4.id, incidentId: incident2.id, linkReason: "Active DSAR with data from affected finance system", subjectInScope: DsarIncidentSubjectStatus.UNKNOWN, linkedByUserId: admin.id },
    ],
  });

  // Incident 2 — Surge Group for related DSARs
  const surgeGroup = await prisma.surgeGroup.create({
    data: {
      tenantId: tenant.id,
      incidentId: incident2.id,
      name: "Data Exfiltration DSAR Surge",
      description: "Grouped DSARs whose data subjects may be affected by the data exfiltration incident. Coordinated processing to ensure consistent handling.",
      createdByUserId: admin.id,
    },
  });

  await prisma.surgeGroupMember.createMany({
    data: [
      { tenantId: tenant.id, surgeGroupId: surgeGroup.id, caseId: case3.id },
      { tenantId: tenant.id, surgeGroupId: surgeGroup.id, caseId: case4.id },
    ],
  });

  // Incident 2 — communication (outbound to regulator)
  await prisma.incidentCommunication.create({
    data: {
      tenantId: tenant.id,
      incidentId: incident2.id,
      direction: "OUTBOUND",
      channel: "EMAIL",
      recipient: "bfdi@bfdi.bund.de",
      subject: "Preliminary notification - Data breach",
      body: "Dear BfDI,\n\nWe are writing to notify you of a potential personal data breach detected on " + daysAgo(5).toISOString().split("T")[0] + ". Investigation is ongoing. Full Article 33 notification to follow within 72 hours.\n\nKind regards,\nACME Corp DPO",
      createdByUserId: dpo.id,
    },
  });

  console.log("Created Incident 2: Data exfiltration suspected (HIGH / OPEN)");
  console.log("Incidents & Authority Linkage (Module 5) seed complete.");

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE 6 — Vendor / Processor Tracking Seed Data
  // ══════════════════════════════════════════════════════════════════════════

  // ── Vendors ───────────────────────────────────────────────────────────────

  const vendorSalesforce = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "Salesforce Inc.",
      shortCode: "SF",
      status: VendorStatus.ACTIVE,
      website: "https://salesforce.com",
      headquartersCountry: "US",
      dpaOnFile: true,
      dpaExpiresAt: new Date("2027-06-30"),
      contractReference: "DPA-2024-001",
    },
  });

  const vendorWorkday = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "Workday Inc.",
      shortCode: "WD",
      status: VendorStatus.ACTIVE,
      website: "https://workday.com",
      headquartersCountry: "US",
      dpaOnFile: true,
      dpaExpiresAt: new Date("2027-03-15"),
      contractReference: "DPA-2024-002",
    },
  });

  const vendorMixpanel = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "Mixpanel Inc.",
      shortCode: "MX",
      status: VendorStatus.ACTIVE,
      website: "https://mixpanel.com",
      headquartersCountry: "US",
      dpaOnFile: true,
      contractReference: "DPA-2024-003",
    },
  });

  const vendorMailchimp = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "Intuit (Mailchimp)",
      shortCode: "MC",
      status: VendorStatus.ACTIVE,
      website: "https://mailchimp.com",
      headquartersCountry: "US",
      dpaOnFile: true,
      contractReference: "DPA-2024-004",
    },
  });

  const vendorMicrosoft = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "Microsoft Corporation",
      shortCode: "MS",
      status: VendorStatus.ACTIVE,
      website: "https://microsoft.com",
      headquartersCountry: "US",
      dpaOnFile: true,
      dpaExpiresAt: new Date("2028-01-01"),
      contractReference: "DPA-2024-005",
    },
  });

  const vendorSap = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "SAP SE",
      shortCode: "SAP",
      status: VendorStatus.ACTIVE,
      website: "https://sap.com",
      headquartersCountry: "DE",
      dpaOnFile: true,
      contractReference: "DPA-2024-006",
    },
  });

  const vendorZendesk = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "Zendesk Inc.",
      shortCode: "ZD",
      status: VendorStatus.ACTIVE,
      website: "https://zendesk.com",
      headquartersCountry: "US",
      dpaOnFile: true,
      contractReference: "DPA-2024-007",
    },
  });

  const vendorOkta = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "Okta Inc.",
      shortCode: "OK",
      status: VendorStatus.ACTIVE,
      website: "https://okta.com",
      headquartersCountry: "US",
      dpaOnFile: true,
      contractReference: "DPA-2024-008",
    },
  });

  const vendorHubspot = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "HubSpot Inc.",
      shortCode: "HS",
      status: VendorStatus.UNDER_REVIEW,
      website: "https://hubspot.com",
      headquartersCountry: "US",
      dpaOnFile: false,
      notes: "DPA renewal pending — expiry date 2025-12-31. Under review for GDPR compliance updates.",
    },
  });

  const vendorAws = await prisma.vendor.create({
    data: {
      tenantId: tenant.id,
      name: "Amazon Web Services",
      shortCode: "AWS",
      status: VendorStatus.ACTIVE,
      website: "https://aws.amazon.com",
      headquartersCountry: "US",
      dpaOnFile: true,
    },
  });

  console.log("Created 10 vendors");

  // ── Vendor Contacts ──────────────────────────────────────────────────────

  await prisma.vendorContact.createMany({
    data: [
      { tenantId: tenant.id, vendorId: vendorSalesforce.id, name: "Sarah Chen", email: "privacy@salesforce.com", role: "Privacy Lead", isPrimary: true },
      { tenantId: tenant.id, vendorId: vendorSalesforce.id, name: "Account Team", email: "account@salesforce.com", role: "Account Manager", isPrimary: false },
      { tenantId: tenant.id, vendorId: vendorWorkday.id, name: "Mark Taylor", email: "dpo@workday.com", role: "DPO", isPrimary: true },
      { tenantId: tenant.id, vendorId: vendorMixpanel.id, name: "Privacy Team", email: "privacy@mixpanel.com", role: "Privacy", isPrimary: true },
      { tenantId: tenant.id, vendorId: vendorMailchimp.id, name: "Compliance Desk", email: "gdpr@mailchimp.com", role: "Compliance", isPrimary: true },
      { tenantId: tenant.id, vendorId: vendorMicrosoft.id, name: "GDPR Response", email: "gdpr@microsoft.com", role: "DPO Office", isPrimary: true },
      { tenantId: tenant.id, vendorId: vendorSap.id, name: "Datenschutz Team", email: "datenschutz@sap.com", role: "DPO", isPrimary: true },
      { tenantId: tenant.id, vendorId: vendorZendesk.id, name: "Privacy Office", email: "privacy@zendesk.com", role: "Privacy Lead", isPrimary: true },
      { tenantId: tenant.id, vendorId: vendorOkta.id, name: "Security Team", email: "security@okta.com", role: "Security", isPrimary: true },
      { tenantId: tenant.id, vendorId: vendorHubspot.id, name: "Legal Dept", email: "legal@hubspot.com", role: "Legal", isPrimary: true },
      { tenantId: tenant.id, vendorId: vendorAws.id, name: "Data Privacy", email: "privacy@aws.amazon.com", role: "Privacy", isPrimary: true },
    ],
  });

  console.log("Created vendor contacts");

  // ── Vendor DPAs ──────────────────────────────────────────────────────────

  await prisma.vendorDpa.createMany({
    data: [
      { tenantId: tenant.id, vendorId: vendorSalesforce.id, title: "Salesforce DPA v3.1", signedAt: new Date("2024-01-15"), expiresAt: new Date("2027-06-30"), sccsIncluded: true },
      { tenantId: tenant.id, vendorId: vendorWorkday.id, title: "Workday Data Processing Addendum", signedAt: new Date("2024-03-01"), expiresAt: new Date("2027-03-15"), sccsIncluded: true },
      { tenantId: tenant.id, vendorId: vendorMicrosoft.id, title: "Microsoft Products & Services DPA", signedAt: new Date("2024-02-01"), expiresAt: new Date("2028-01-01"), sccsIncluded: true },
      { tenantId: tenant.id, vendorId: vendorSap.id, title: "SAP Cloud DPA (DE)", signedAt: new Date("2024-04-15"), sccsIncluded: false, notes: "EU data residency — no third country transfer" },
      { tenantId: tenant.id, vendorId: vendorZendesk.id, title: "Zendesk DPA", signedAt: new Date("2024-05-01"), sccsIncluded: true },
      { tenantId: tenant.id, vendorId: vendorAws.id, title: "AWS GDPR DPA", signedAt: new Date("2024-06-01"), sccsIncluded: true },
    ],
  });

  console.log("Created vendor DPAs");

  // ── Link SystemProcessors to Vendors ─────────────────────────────────────

  // Update existing system processors to link to normalized vendors
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "Salesforce Inc." }, data: { vendorId: vendorSalesforce.id } });
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "Workday Inc." }, data: { vendorId: vendorWorkday.id } });
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "Mixpanel Inc." }, data: { vendorId: vendorMixpanel.id } });
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "Intuit (Mailchimp)" }, data: { vendorId: vendorMailchimp.id } });
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "Microsoft Corporation" }, data: { vendorId: vendorMicrosoft.id } });
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "SAP SE" }, data: { vendorId: vendorSap.id } });
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "Zendesk Inc." }, data: { vendorId: vendorZendesk.id } });
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "AWS (Zendesk hosting)" }, data: { vendorId: vendorAws.id } });
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "Okta Inc." }, data: { vendorId: vendorOkta.id } });
  await prisma.systemProcessor.updateMany({ where: { tenantId: tenant.id, vendorName: "HubSpot Inc." }, data: { vendorId: vendorHubspot.id } });

  console.log("Linked system processors to vendors");

  // ── Vendor SLA Configs ───────────────────────────────────────────────────

  await prisma.vendorSlaConfig.createMany({
    data: [
      { tenantId: tenant.id, vendorId: vendorSalesforce.id, defaultDueDays: 10, reminderAfterDays: 5, escalationAfterDays: 10, maxReminders: 2, autoEscalate: true },
      { tenantId: tenant.id, vendorId: vendorWorkday.id, defaultDueDays: 14, reminderAfterDays: 7, escalationAfterDays: 14, maxReminders: 3, autoEscalate: true },
      { tenantId: tenant.id, vendorId: vendorSap.id, defaultDueDays: 7, reminderAfterDays: 3, escalationAfterDays: 7, maxReminders: 2, autoEscalate: true },
    ],
  });

  console.log("Created vendor SLA configs");

  // ── Vendor Request Templates ─────────────────────────────────────────────

  await prisma.vendorRequestTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Standard DSAR Data Request (EN)",
      language: "en",
      dsarTypes: [DSARType.ACCESS, DSARType.PORTABILITY],
      subject: "Data Subject Access Request – {{caseNumber}}",
      bodyHtml: `<p>Dear {{vendorName}} Privacy Team,</p>
<p>We are processing a Data Subject Access Request (case {{caseNumber}}) under the GDPR and require your assistance.</p>
<p><strong>Data Subject:</strong> {{subjectName}}<br/><strong>Request Type:</strong> {{dsarType}}<br/><strong>Deadline:</strong> {{dueDate}}</p>
<p>Please provide all personal data held about this individual within the agreed SLA period.</p>
<p>Best regards,<br/>{{tenantName}} Privacy Team</p>`,
      placeholders: [
        { key: "caseNumber", label: "Case Number", description: "DSAR case reference" },
        { key: "vendorName", label: "Vendor Name" },
        { key: "subjectName", label: "Data Subject Name" },
        { key: "dsarType", label: "DSAR Type" },
        { key: "dueDate", label: "Due Date" },
        { key: "tenantName", label: "Organization Name" },
      ],
      isDefault: true,
    },
  });

  await prisma.vendorRequestTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Standardanfrage Betroffenenanfrage (DE)",
      language: "de",
      dsarTypes: [DSARType.ACCESS, DSARType.ERASURE, DSARType.PORTABILITY],
      subject: "Betroffenenanfrage – {{caseNumber}}",
      bodyHtml: `<p>Sehr geehrtes {{vendorName}} Datenschutz-Team,</p>
<p>Wir bearbeiten eine Betroffenenanfrage (Aktenzeichen {{caseNumber}}) gemäß DSGVO und benötigen Ihre Unterstützung.</p>
<p><strong>Betroffene Person:</strong> {{subjectName}}<br/><strong>Art der Anfrage:</strong> {{dsarType}}<br/><strong>Frist:</strong> {{dueDate}}</p>
<p>Bitte übermitteln Sie alle personenbezogenen Daten dieser Person innerhalb der vereinbarten SLA-Frist.</p>
<p>Mit freundlichen Grüßen,<br/>{{tenantName}} Datenschutzteam</p>`,
      placeholders: [
        { key: "caseNumber", label: "Aktenzeichen" },
        { key: "vendorName", label: "Auftragsverarbeiter" },
        { key: "subjectName", label: "Betroffene Person" },
        { key: "dsarType", label: "Anfrageart" },
        { key: "dueDate", label: "Frist" },
        { key: "tenantName", label: "Organisation" },
      ],
      isDefault: false,
    },
  });

  await prisma.vendorRequestTemplate.create({
    data: {
      tenantId: tenant.id,
      vendorId: vendorSalesforce.id,
      name: "Salesforce-Specific Data Export Request",
      language: "en",
      dsarTypes: [DSARType.ACCESS],
      subject: "Salesforce Data Export – {{caseNumber}}",
      bodyHtml: `<p>Dear Salesforce Privacy Team,</p>
<p>Please export the following data for DSAR case {{caseNumber}}:</p>
<ul><li>Contact records matching: {{subjectName}}</li><li>Activity history</li><li>Case attachments</li></ul>
<p>Please deliver via Salesforce Data Export API or encrypted file transfer.</p>
<p>Best regards,<br/>{{tenantName}}</p>`,
      placeholders: [
        { key: "caseNumber", label: "Case Number" },
        { key: "subjectName", label: "Data Subject Name" },
        { key: "tenantName", label: "Organization Name" },
      ],
      isDefault: false,
    },
  });

  console.log("Created vendor request templates");

  // ── Demo Vendor Requests ─────────────────────────────────────────────────

  // Case 1 — vendor request to Salesforce (SENT, approaching due)
  const vendorReq1 = await prisma.vendorRequest.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      vendorId: vendorSalesforce.id,
      systemId: crmSystem.id,
      status: VendorRequestStatus.SENT,
      subject: "Data Subject Access Request – " + case1.caseNumber,
      bodyHtml: "<p>Dear Salesforce Privacy Team,</p><p>Please provide all personal data for John Smith (john.smith@example.com).</p>",
      sentAt: daysAgo(7),
      dueAt: daysFromNow(3),
      createdByUserId: caseManager.id,
      items: {
        create: [
          { tenantId: tenant.id, systemId: crmSystem.id, description: "Export contact record and activity history from Salesforce CRM", status: "IN_PROGRESS" },
        ],
      },
    },
  });

  // Case 1 — vendor request to Mixpanel (RESPONDED)
  const vendorReq2 = await prisma.vendorRequest.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      vendorId: vendorMixpanel.id,
      systemId: analyticsSystem.id,
      status: VendorRequestStatus.RESPONDED,
      subject: "Data Subject Access Request – " + case1.caseNumber,
      bodyHtml: "<p>Dear Mixpanel Privacy Team,</p><p>Please provide analytics data for user john.smith@example.com.</p>",
      sentAt: daysAgo(10),
      dueAt: daysAgo(3),
      createdByUserId: caseManager.id,
      items: {
        create: [
          { tenantId: tenant.id, systemId: analyticsSystem.id, description: "Export user events and profile data from Mixpanel", status: "COMPLETED", completedAt: daysAgo(2) },
        ],
      },
    },
  });

  // Add vendor response for Mixpanel
  await prisma.vendorResponse.create({
    data: {
      tenantId: tenant.id,
      requestId: vendorReq2.id,
      responseType: VendorResponseType.DATA_EXTRACT,
      receivedAt: daysAgo(2),
      summary: "Full user event export (1,247 events) and profile data provided as JSON",
      createdByUserId: contributor.id,
    },
  });

  // Case 2 — vendor request to SAP (OVERDUE)
  const vendorReq3 = await prisma.vendorRequest.create({
    data: {
      tenantId: tenant.id,
      caseId: case2.id,
      vendorId: vendorSap.id,
      systemId: financeSystem.id,
      status: VendorRequestStatus.OVERDUE,
      subject: "Erasure Request – " + case2.caseNumber,
      bodyHtml: "<p>Dear SAP Datenschutz Team,</p><p>We require confirmation of data erasure for Jane Doe across all SAP modules.</p>",
      sentAt: daysAgo(20),
      dueAt: daysAgo(6),
      reminderCount: 2,
      lastReminderAt: daysAgo(3),
      createdByUserId: dpo.id,
      items: {
        create: [
          { tenantId: tenant.id, systemId: financeSystem.id, description: "Confirm erasure of financial records for data subject", status: "PENDING" },
        ],
      },
    },
  });

  // Escalation for overdue SAP request
  await prisma.vendorEscalation.create({
    data: {
      tenantId: tenant.id,
      vendorId: vendorSap.id,
      requestId: vendorReq3.id,
      severity: VendorEscalationSeverity.WARNING,
      reason: "SAP erasure request overdue by 6 days. Two reminders sent without response.",
      createdByUserId: dpo.id,
    },
  });

  // Case 3 — vendor request to Workday (DRAFT — not yet sent)
  await prisma.vendorRequest.create({
    data: {
      tenantId: tenant.id,
      caseId: case3.id,
      vendorId: vendorWorkday.id,
      systemId: hrSystem.id,
      status: VendorRequestStatus.DRAFT,
      subject: "Rectification Request – " + case3.caseNumber,
      bodyHtml: "<p>Dear Workday DPO,</p><p>We have received a request to rectify the address and phone number for Robert Johnson in Workday HR.</p>",
      dueAt: daysFromNow(14),
      createdByUserId: admin.id,
      items: {
        create: [
          { tenantId: tenant.id, systemId: hrSystem.id, description: "Update employee record: address and phone number correction", status: "PENDING" },
        ],
      },
    },
  });

  // Case 4 — vendor request to Microsoft (ACKNOWLEDGED)
  await prisma.vendorRequest.create({
    data: {
      tenantId: tenant.id,
      caseId: case4.id,
      vendorId: vendorMicrosoft.id,
      systemId: m365System.id,
      status: VendorRequestStatus.ACKNOWLEDGED,
      subject: "Data Subject Access Request – " + case4.caseNumber,
      bodyHtml: "<p>Dear Microsoft GDPR Team,</p><p>Please export all M365 data for the data subject (Emily Wilson).</p>",
      sentAt: daysAgo(5),
      acknowledgedAt: daysAgo(3),
      dueAt: daysFromNow(9),
      createdByUserId: caseManager.id,
      items: {
        create: [
          { tenantId: tenant.id, systemId: m365System.id, description: "Export mailbox, OneDrive, and Teams data for data subject", status: "IN_PROGRESS" },
        ],
      },
    },
  });

  console.log("Created demo vendor requests for cases 1-4");
  console.log("Vendor / Processor Tracking (Module 6) seed complete.");

  // ═════════════════════════════════════════════════════════════════════════
  // MODULE 7: Executive Privacy KPI & Board Reporting — 12-month history
  // ═════════════════════════════════════════════════════════════════════════

  console.log("Seeding Executive KPI data (Module 7)...");

  // KPI Config
  await prisma.privacyKpiConfig.create({
    data: {
      tenantId: tenant.id,
      estimatedCostPerDsar: 150,
      estimatedMinutesManual: 480,
      estimatedMinutesAutomated: 120,
      maturityWeights: {
        documentation: 0.2,
        automation: 0.25,
        sla_compliance: 0.25,
        incident_integration: 0.15,
        vendor_coordination: 0.15,
      },
      snapshotCron: "0 2 1 * *",
    },
  });

  // Generate 12 months of KPI snapshots with realistic trends
  const now = new Date();
  for (let m = 11; m >= 0; m--) {
    const snapshotDate = new Date(now.getFullYear(), now.getMonth() - m, 1);

    // Simulate growing DSAR volume with seasonal spike in month 6
    const seasonalMultiplier = m === 5 ? 1.8 : m === 4 ? 1.3 : 1.0;
    const baseDsars = Math.round((15 + (11 - m) * 2) * seasonalMultiplier);
    const openRate = Math.max(0.1, 0.4 - (11 - m) * 0.02);
    const openDsars = Math.round(baseDsars * openRate);
    const closedDsars = baseDsars - openDsars;

    // Improving close times over 12 months
    const avgCloseTime = Math.round((25 - (11 - m) * 1.2) * 10) / 10;
    const medianCloseTime = Math.round((avgCloseTime - 3) * 10) / 10;

    // Decreasing overdue rate
    const overdueRate = Math.max(0, Math.round((18 - (11 - m) * 1.5) * 10) / 10);
    const extensionRate = Math.max(2, Math.round((12 - (11 - m) * 0.8) * 10) / 10);

    // Risk distribution shift from red to green
    const redCases = Math.max(0, Math.round(5 - (11 - m) * 0.4));
    const yellowCases = Math.round(3 + Math.sin(m) * 1.5);
    const greenCases = openDsars - redCases - yellowCases;

    // Automation improving
    const autoSuggested = Math.min(85, Math.round(20 + (11 - m) * 5.5));
    const templateResponse = Math.min(90, Math.round(15 + (11 - m) * 6));
    const idvAutomation = Math.min(75, Math.round(10 + (11 - m) * 5));
    const apiReady = Math.min(80, Math.round(25 + (11 - m) * 4));

    // Governance improving
    const dpaOnFile = Math.min(95, Math.round(50 + (11 - m) * 4));
    const systemsComplete = Math.min(90, Math.round(40 + (11 - m) * 4.5));
    const retentionDefined = Math.min(85, Math.round(30 + (11 - m) * 4));
    const thirdCountry = Math.round(15 + Math.sin(m) * 3);

    // Incident linkage: spike month 6
    const incidentLinked = m === 5 ? 35 : Math.round(10 + (11 - m) * 1.5);
    const highRiskCases = redCases;
    const incidentLinkedHighRisk = Math.min(highRiskCases, Math.round(highRiskCases * 0.6));
    const vendorOverdue = Math.max(0, Math.round(4 - (11 - m) * 0.35));

    // Financial
    const costPerDsar = 150;
    const timeSaved = 360;
    const totalTimeSaved = closedDsars * timeSaved;

    // Maturity score improving
    const maturityScore = Math.min(95, Math.round((35 + (11 - m) * 5) * 10) / 10);

    await prisma.privacyKpiSnapshot.create({
      data: {
        tenantId: tenant.id,
        period: "MONTHLY" as KpiSnapshotPeriod,
        snapshotDate,
        totalDsars: baseDsars,
        openDsars,
        closedDsars,
        avgTimeToCloseDays: avgCloseTime,
        medianTimeToCloseDays: medianCloseTime,
        extensionRatePct: extensionRate,
        overdueRatePct: overdueRate,
        dsarsByType: { ACCESS: Math.round(baseDsars * 0.5), ERASURE: Math.round(baseDsars * 0.25), RECTIFICATION: Math.round(baseDsars * 0.15), PORTABILITY: Math.round(baseDsars * 0.1) },
        dsarsLinkedToIncidentPct: incidentLinked,
        riskDistribution: { green: Math.max(0, greenCases), yellow: Math.max(0, yellowCases), red: redCases },
        highRiskCasesCount: highRiskCases,
        incidentLinkedHighRiskCount: incidentLinkedHighRisk,
        vendorOverdueCount: vendorOverdue,
        autoSuggestedSystemsPct: autoSuggested,
        vendorAutoGeneratedPct: Math.min(70, Math.round(10 + (11 - m) * 5)),
        templateResponsePct: templateResponse,
        idvAutomationPct: idvAutomation,
        apiReadySystemsPct: apiReady,
        dpaOnFilePct: dpaOnFile,
        systemsCompleteMetaPct: systemsComplete,
        retentionDefinedPct: retentionDefined,
        thirdCountryTransferRatio: thirdCountry,
        estimatedCostPerDsar: costPerDsar,
        estimatedTimeSavedPerDsar: timeSaved,
        totalTimeSavedMonthly: totalTimeSaved,
        maturityScore,
        rawData: {},
      },
    });

    // Maturity scores by domain
    const domains: MaturityDomain[] = ["DOCUMENTATION", "AUTOMATION", "SLA_COMPLIANCE", "INCIDENT_INTEGRATION", "VENDOR_COORDINATION"];
    const domainScores: Record<string, number> = {
      DOCUMENTATION: systemsComplete,
      AUTOMATION: Math.round((autoSuggested * 0.4 + templateResponse * 0.3 + apiReady * 0.3)),
      SLA_COMPLIANCE: Math.max(0, 100 - overdueRate),
      INCIDENT_INTEGRATION: Math.min(100, incidentLinked + 50),
      VENDOR_COORDINATION: vendorOverdue === 0 ? 100 : Math.max(0, 100 - vendorOverdue * 10),
    };

    for (const domain of domains) {
      await prisma.maturityScore.create({
        data: {
          tenantId: tenant.id,
          domain,
          month: snapshotDate,
          score: domainScores[domain],
          details: {},
        },
      });
    }

    // Automation metrics
    await prisma.automationMetric.create({
      data: {
        tenantId: tenant.id,
        month: snapshotDate,
        totalCases: baseDsars,
        casesWithAutoSystems: Math.round(baseDsars * autoSuggested / 100),
        vendorRequestsTotal: Math.round(baseDsars * 0.6),
        vendorRequestsAuto: Math.round(baseDsars * 0.6 * Math.min(70, Math.round(10 + (11 - m) * 5)) / 100),
        responsesTotal: closedDsars,
        responsesViaTemplate: Math.round(closedDsars * templateResponse / 100),
        idvRequestsTotal: baseDsars,
        idvRequestsAutomated: Math.round(baseDsars * idvAutomation / 100),
      },
    });
  }

  // KPI Thresholds
  const thresholds = [
    { kpiKey: "overdueRatePct", greenMax: 5, yellowMax: 15, direction: "lower_is_better" },
    { kpiKey: "avgTimeToCloseDays", greenMax: 15, yellowMax: 25, direction: "lower_is_better" },
    { kpiKey: "maturityScore", greenMax: 100, yellowMax: 70, direction: "higher_is_better" },
    { kpiKey: "dpaOnFilePct", greenMax: 100, yellowMax: 80, direction: "higher_is_better" },
    { kpiKey: "templateResponsePct", greenMax: 100, yellowMax: 60, direction: "higher_is_better" },
  ];

  for (const t of thresholds) {
    await prisma.kpiThreshold.create({
      data: {
        tenantId: tenant.id,
        kpiKey: t.kpiKey,
        greenMax: t.greenMax,
        yellowMax: t.yellowMax,
        direction: t.direction,
      },
    });
  }

  // Executive Report definition
  await prisma.executiveReport.create({
    data: {
      tenantId: tenant.id,
      name: "Monthly Board Privacy Report",
      description: "Comprehensive monthly privacy KPI report for board review",
      sections: ["executive_summary", "dsar_metrics", "risk_compliance", "automation_efficiency", "governance_maturity", "forecasting", "recommendations"],
      active: true,
    },
  });

  console.log("Created 12-month KPI snapshot history with maturity scores, automation metrics, thresholds, and report template.");
  console.log("Executive KPI & Board Reporting (Module 7) seed complete.");

  // ═══════════════════════════════════════════════════════════════════════════
  // MVP Discovery & Scan Data
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Additional Data Subjects (for 20 total cases) ─────────────────────────
  const mvpSubjects = await Promise.all([
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Anna Müller", email: "anna.mueller@example.de", phone: "+49-30-1234567", preferredLanguage: "de" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Marco Rossi", email: "marco.rossi@example.it", preferredLanguage: "it" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Sophie Dupont", email: "sophie.dupont@example.fr", phone: "+33-1-42-68-53-00", preferredLanguage: "fr" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Lars Eriksson", email: "lars.eriksson@example.se", preferredLanguage: "en" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Fatima Al-Hassan", email: "fatima.alhassan@example.com", preferredLanguage: "en" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Thomas Weber", email: "thomas.weber@example.de", phone: "+49-89-5551234", preferredLanguage: "de" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Yuki Tanaka", email: "yuki.tanaka@example.jp", preferredLanguage: "en" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Carlos Silva", email: "carlos.silva@example.pt", preferredLanguage: "en" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Priya Patel", email: "priya.patel@example.in", phone: "+91-22-2345-6789", preferredLanguage: "en" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Oliver Brown", email: "oliver.brown@example.co.uk", preferredLanguage: "en" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Elena Kowalski", email: "elena.kowalski@example.pl", preferredLanguage: "en" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Henrik Nielsen", email: "henrik.nielsen@example.dk", preferredLanguage: "en" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Maria Garcia", email: "maria.garcia@example.es", phone: "+34-91-123-4567", preferredLanguage: "es" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "James Wilson", email: "james.wilson@example.com", preferredLanguage: "en" } }),
    prisma.dataSubject.create({ data: { tenantId: tenant.id, fullName: "Lena Schmidt", email: "lena.schmidt@example.de", preferredLanguage: "de" } }),
  ]);
  console.log(`Created ${mvpSubjects.length} additional data subjects`);

  // ── Additional DSAR Cases (15 more → 20 total) ───────────────────────────
  const mvpCaseConfigs: Array<{
    num: string; type: DSARType; status: CaseStatus; priority: CasePriority;
    receivedDaysAgo: number; dueDaysFromNow: number; subjectIdx: number;
    assignee: string | null; desc: string;
  }> = [
    { num: "DSAR-2026-P6Q7R8", type: DSARType.ACCESS, status: CaseStatus.NEW, priority: CasePriority.MEDIUM, receivedDaysAgo: 1, dueDaysFromNow: 29, subjectIdx: 0, assignee: "manager", desc: "Subject requests full data access copy." },
    { num: "DSAR-2026-S9T0U1", type: DSARType.ERASURE, status: CaseStatus.IDENTITY_VERIFICATION, priority: CasePriority.HIGH, receivedDaysAgo: 5, dueDaysFromNow: 25, subjectIdx: 1, assignee: "manager", desc: "Subject requests deletion of account and all related data." },
    { num: "DSAR-2026-V2W3X4", type: DSARType.ACCESS, status: CaseStatus.DATA_COLLECTION, priority: CasePriority.HIGH, receivedDaysAgo: 12, dueDaysFromNow: 18, subjectIdx: 2, assignee: "dpo", desc: "Full data access request from French customer." },
    { num: "DSAR-2026-Y5Z6A7", type: DSARType.RECTIFICATION, status: CaseStatus.INTAKE_TRIAGE, priority: CasePriority.LOW, receivedDaysAgo: 3, dueDaysFromNow: 27, subjectIdx: 3, assignee: "manager", desc: "Address correction request." },
    { num: "DSAR-2026-B8C9D0", type: DSARType.PORTABILITY, status: CaseStatus.DATA_COLLECTION, priority: CasePriority.MEDIUM, receivedDaysAgo: 10, dueDaysFromNow: 20, subjectIdx: 4, assignee: "contributor", desc: "Data portability request for transfer to another provider." },
    { num: "DSAR-2026-E1F2G3", type: DSARType.OBJECTION, status: CaseStatus.REVIEW_LEGAL, priority: CasePriority.CRITICAL, receivedDaysAgo: 20, dueDaysFromNow: 10, subjectIdx: 5, assignee: "dpo", desc: "Subject objects to profiling for marketing purposes." },
    { num: "DSAR-2026-H4I5J6", type: DSARType.ACCESS, status: CaseStatus.RESPONSE_PREPARATION, priority: CasePriority.MEDIUM, receivedDaysAgo: 22, dueDaysFromNow: 8, subjectIdx: 6, assignee: "manager", desc: "Employee data access request." },
    { num: "DSAR-2026-K7L8M9", type: DSARType.ERASURE, status: CaseStatus.DATA_COLLECTION, priority: CasePriority.HIGH, receivedDaysAgo: 8, dueDaysFromNow: 22, subjectIdx: 7, assignee: "manager", desc: "Customer requests erasure after account closure." },
    { num: "DSAR-2026-N0P1Q2", type: DSARType.ACCESS, status: CaseStatus.CLOSED, priority: CasePriority.LOW, receivedDaysAgo: 45, dueDaysFromNow: -15, subjectIdx: 8, assignee: "manager", desc: "Data access request — completed and delivered." },
    { num: "DSAR-2026-R3S4T5", type: DSARType.RESTRICTION, status: CaseStatus.NEW, priority: CasePriority.MEDIUM, receivedDaysAgo: 1, dueDaysFromNow: 29, subjectIdx: 9, assignee: null, desc: "Subject requests restriction of processing pending dispute." },
    { num: "DSAR-2026-U6V7W8", type: DSARType.ACCESS, status: CaseStatus.IDENTITY_VERIFICATION, priority: CasePriority.MEDIUM, receivedDaysAgo: 4, dueDaysFromNow: 26, subjectIdx: 10, assignee: "contributor", desc: "Access request from former employee." },
    { num: "DSAR-2026-X9Y0Z1", type: DSARType.ERASURE, status: CaseStatus.REJECTED, priority: CasePriority.LOW, receivedDaysAgo: 30, dueDaysFromNow: 0, subjectIdx: 11, assignee: "dpo", desc: "Erasure request rejected — legal retention obligations apply." },
    { num: "DSAR-2026-A2B3C4", type: DSARType.ACCESS, status: CaseStatus.RESPONSE_SENT, priority: CasePriority.MEDIUM, receivedDaysAgo: 28, dueDaysFromNow: 2, subjectIdx: 12, assignee: "manager", desc: "Access response package sent to data subject." },
    { num: "DSAR-2026-D5E6F7", type: DSARType.PORTABILITY, status: CaseStatus.INTAKE_TRIAGE, priority: CasePriority.MEDIUM, receivedDaysAgo: 2, dueDaysFromNow: 28, subjectIdx: 13, assignee: "manager", desc: "Data portability request for CRM data." },
    { num: "DSAR-2026-G8H9I0", type: DSARType.OBJECTION, status: CaseStatus.DATA_COLLECTION, priority: CasePriority.HIGH, receivedDaysAgo: 14, dueDaysFromNow: 16, subjectIdx: 14, assignee: "dpo", desc: "Subject objects to automated decision-making." },
  ];

  const userLookup: Record<string, string> = {
    manager: caseManager.id,
    dpo: dpo.id,
    contributor: contributor.id,
  };

  const mvpCases = [];
  for (const cfg of mvpCaseConfigs) {
    const c = await prisma.dSARCase.create({
      data: {
        tenantId: tenant.id,
        caseNumber: cfg.num,
        type: cfg.type,
        status: cfg.status,
        priority: cfg.priority,
        receivedAt: daysAgo(cfg.receivedDaysAgo),
        dueDate: cfg.dueDaysFromNow >= 0 ? daysFromNow(cfg.dueDaysFromNow) : daysAgo(-cfg.dueDaysFromNow),
        channel: "Email",
        requesterType: "Data Subject",
        description: cfg.desc,
        identityVerified: !["NEW", "IDENTITY_VERIFICATION"].includes(cfg.status),
        dataSubjectId: mvpSubjects[cfg.subjectIdx].id,
        createdByUserId: admin.id,
        assignedToUserId: cfg.assignee ? userLookup[cfg.assignee] : null,
      },
    });
    mvpCases.push(c);
  }
  const allCases = [case1, case2, case3, case4, case5, ...mvpCases];
  console.log(`Created ${mvpCases.length} additional DSAR cases (${allCases.length} total)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // ██  DISCOVERY DATA — Realistic demo findings & data assets
  // ═══════════════════════════════════════════════════════════════════════════

  const mvpSystems = [
    { sys: m365System, label: "M365" },
    { sys: exchangeSystem, label: "Exchange" },
    { sys: sharepointSystem, label: "SharePoint" },
    { sys: fileShareSystem, label: "Fileserver" },
  ];

  // ── Data Assets (80 across 4 systems, 20 each) ─────────────────────────────
  // Realistic paths: SharePoint URLs, OneDrive paths, mailbox folders, UNC paths
  const assetDefs: Array<{ sysLabel: string; name: string; path: string; cat: DataCategory; score: number; personal: boolean; special: boolean }> = [
    // ── M365 assets (20) — OneDrive, Teams, Entra ID ──────────────────────
    { sysLabel: "M365", name: "OneDrive - Management", path: "OneDrive / management-team / *", cat: DataCategory.HR, score: 70, personal: true, special: false },
    { sysLabel: "M365", name: "OneDrive - Sales", path: "OneDrive / sales-team / *", cat: DataCategory.CONTRACT, score: 45, personal: true, special: false },
    { sysLabel: "M365", name: "OneDrive - DPO Private", path: "OneDrive / david.dpo / DSAR-Working", cat: DataCategory.IDENTIFICATION, score: 88, personal: true, special: true },
    { sysLabel: "M365", name: "OneDrive - CEO", path: "OneDrive / ceo / PersonalDocs", cat: DataCategory.HR, score: 76, personal: true, special: false },
    { sysLabel: "M365", name: "OneDrive - HR Director", path: "OneDrive / hr-director / Compensation-Reviews", cat: DataCategory.PAYMENT, score: 90, personal: true, special: false },
    { sysLabel: "M365", name: "Teams Chat Logs", path: "Teams / chats / *", cat: DataCategory.COMMUNICATION, score: 50, personal: true, special: false },
    { sysLabel: "M365", name: "Teams Channel Files", path: "Teams / channels / General / files", cat: DataCategory.OTHER, score: 20, personal: false, special: false },
    { sysLabel: "M365", name: "Teams - HR Private Channel", path: "Teams / channels / HR-Confidential / files", cat: DataCategory.HR, score: 83, personal: true, special: true },
    { sysLabel: "M365", name: "Entra ID User Directory", path: "Entra ID / users", cat: DataCategory.IDENTIFICATION, score: 75, personal: true, special: false },
    { sysLabel: "M365", name: "Entra ID Sign-in Logs", path: "Entra ID / signInLogs", cat: DataCategory.ONLINE_TECHNICAL, score: 40, personal: true, special: false },
    { sysLabel: "M365", name: "Entra ID Guest Users", path: "Entra ID / users?$filter=userType eq 'Guest'", cat: DataCategory.IDENTIFICATION, score: 50, personal: true, special: false },
    { sysLabel: "M365", name: "Compliance Center - eDiscovery", path: "Compliance Center / eDiscovery / *", cat: DataCategory.COMMUNICATION, score: 70, personal: true, special: false },
    { sysLabel: "M365", name: "Planner Tasks", path: "Planner / plans / *", cat: DataCategory.OTHER, score: 15, personal: false, special: false },
    { sysLabel: "M365", name: "Power Automate Flows", path: "PowerAutomate / flows / HR-Onboarding", cat: DataCategory.HR, score: 35, personal: true, special: false },
    { sysLabel: "M365", name: "Forms - Employee Surveys", path: "Forms / responses / Employee-Satisfaction-2025", cat: DataCategory.HR, score: 62, personal: true, special: false },
    { sysLabel: "M365", name: "Lists - Asset Inventory", path: "SharePoint / lists / IT-Assets", cat: DataCategory.ONLINE_TECHNICAL, score: 28, personal: true, special: false },
    { sysLabel: "M365", name: "Intune Device Inventory", path: "Intune / managedDevices / *", cat: DataCategory.ONLINE_TECHNICAL, score: 32, personal: true, special: false },
    { sysLabel: "M365", name: "Security & Compliance Alerts", path: "Security Center / alerts / *", cat: DataCategory.ONLINE_TECHNICAL, score: 38, personal: true, special: false },
    { sysLabel: "M365", name: "Yammer Community Posts", path: "Yammer / messages / *", cat: DataCategory.COMMUNICATION, score: 42, personal: true, special: false },
    { sysLabel: "M365", name: "Bookings Customer Data", path: "Bookings / appointments / customerInfo", cat: DataCategory.CONTACT, score: 55, personal: true, special: false },
    // ── Exchange assets (20) — Mailbox folders, shared mailboxes ─────────
    { sysLabel: "Exchange", name: "Inbox - All Users", path: "Exchange Online / Mailboxes / Inbox / *", cat: DataCategory.COMMUNICATION, score: 65, personal: true, special: false },
    { sysLabel: "Exchange", name: "Sent Items Archive", path: "Exchange Online / Mailboxes / SentItems / *", cat: DataCategory.COMMUNICATION, score: 60, personal: true, special: false },
    { sysLabel: "Exchange", name: "Calendar Events", path: "Exchange Online / Calendars / *", cat: DataCategory.CONTACT, score: 30, personal: true, special: false },
    { sysLabel: "Exchange", name: "Deleted Items Retention", path: "Exchange Online / Mailboxes / RecoverableItems", cat: DataCategory.COMMUNICATION, score: 55, personal: true, special: false },
    { sysLabel: "Exchange", name: "Shared Mailbox - HR Enquiries", path: "Exchange Online / SharedMailboxes / hr-enquiries@acme-corp.com", cat: DataCategory.HR, score: 72, personal: true, special: true },
    { sysLabel: "Exchange", name: "Shared Mailbox - GDPR Inbox", path: "Exchange Online / SharedMailboxes / gdpr@acme-corp.com", cat: DataCategory.COMMUNICATION, score: 68, personal: true, special: false },
    { sysLabel: "Exchange", name: "Shared Mailbox - Finance AP", path: "Exchange Online / SharedMailboxes / accounts-payable@acme-corp.com", cat: DataCategory.PAYMENT, score: 74, personal: true, special: false },
    { sysLabel: "Exchange", name: "Shared Mailbox - Recruiting", path: "Exchange Online / SharedMailboxes / recruiting@acme-corp.com", cat: DataCategory.IDENTIFICATION, score: 80, personal: true, special: false },
    { sysLabel: "Exchange", name: "Journal Mailbox", path: "Exchange Online / Journaling / journal@acme-corp.com", cat: DataCategory.COMMUNICATION, score: 78, personal: true, special: false },
    { sysLabel: "Exchange", name: "Public Folder - Contacts", path: "Exchange Online / PublicFolders / CompanyContacts", cat: DataCategory.CONTACT, score: 52, personal: true, special: false },
    { sysLabel: "Exchange", name: "Public Folder - Forms", path: "Exchange Online / PublicFolders / HRForms", cat: DataCategory.HR, score: 48, personal: true, special: false },
    { sysLabel: "Exchange", name: "Room Mailbox Logs", path: "Exchange Online / RoomMailboxes / BookingHistory / *", cat: DataCategory.ONLINE_TECHNICAL, score: 22, personal: true, special: false },
    { sysLabel: "Exchange", name: "Distribution List Archive", path: "Exchange Online / DistributionLists / All-Staff / archive", cat: DataCategory.CONTACT, score: 35, personal: true, special: false },
    { sysLabel: "Exchange", name: "Litigation Hold Mailboxes", path: "Exchange Online / LitigationHold / *", cat: DataCategory.COMMUNICATION, score: 82, personal: true, special: false },
    { sysLabel: "Exchange", name: "Transport Rules Quarantine", path: "Exchange Online / TransportRules / Quarantine / *", cat: DataCategory.COMMUNICATION, score: 45, personal: true, special: false },
    { sysLabel: "Exchange", name: "Auto-forwarded Messages", path: "Exchange Online / Mailboxes / AutoForwarded / *", cat: DataCategory.COMMUNICATION, score: 58, personal: true, special: false },
    { sysLabel: "Exchange", name: "Executive Mailbox - CEO", path: "Exchange Online / Mailboxes / ceo@acme-corp.com", cat: DataCategory.HR, score: 85, personal: true, special: false },
    { sysLabel: "Exchange", name: "Legal Hold Discovery", path: "Exchange Online / eDiscovery / LegalCases / *", cat: DataCategory.CONTRACT, score: 76, personal: true, special: false },
    { sysLabel: "Exchange", name: "Message Trace Logs", path: "Exchange Online / MessageTrace / last90days", cat: DataCategory.ONLINE_TECHNICAL, score: 40, personal: true, special: false },
    { sysLabel: "Exchange", name: "DLP Policy Matches", path: "Exchange Online / DLPReports / PolicyMatches / *", cat: DataCategory.IDENTIFICATION, score: 70, personal: true, special: false },
    // ── SharePoint assets (20) — Site URLs, document libraries ───────────
    { sysLabel: "SharePoint", name: "HR Internal Site", path: "https://acme-corp.sharepoint.com/sites/HR-Internal", cat: DataCategory.HR, score: 85, personal: true, special: true },
    { sysLabel: "SharePoint", name: "Finance Site", path: "https://acme-corp.sharepoint.com/sites/Finance", cat: DataCategory.PAYMENT, score: 78, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Legal & Compliance Site", path: "https://acme-corp.sharepoint.com/sites/Legal-Compliance", cat: DataCategory.CONTRACT, score: 55, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Customer Portal Site", path: "https://acme-corp.sharepoint.com/sites/CustomerPortal", cat: DataCategory.CONTRACT, score: 60, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Executive Reports Library", path: "https://acme-corp.sharepoint.com/sites/Executive/Reports", cat: DataCategory.HR, score: 74, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Board Documents", path: "https://acme-corp.sharepoint.com/sites/Board/SharedDocuments", cat: DataCategory.IDENTIFICATION, score: 80, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Recruiting Applications", path: "https://acme-corp.sharepoint.com/sites/Recruiting/Applications", cat: DataCategory.IDENTIFICATION, score: 82, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Procurement Contracts", path: "https://acme-corp.sharepoint.com/sites/Procurement/Contracts", cat: DataCategory.CONTRACT, score: 45, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Employee Handbook", path: "https://acme-corp.sharepoint.com/sites/HR-Internal/Policies", cat: DataCategory.HR, score: 25, personal: false, special: false },
    { sysLabel: "SharePoint", name: "Payroll Shared Library", path: "https://acme-corp.sharepoint.com/sites/Finance/Payroll", cat: DataCategory.PAYMENT, score: 92, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Customer Onboarding Docs", path: "https://acme-corp.sharepoint.com/sites/Sales/Onboarding", cat: DataCategory.IDENTIFICATION, score: 68, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Vendor Due Diligence", path: "https://acme-corp.sharepoint.com/sites/Procurement/VendorDD", cat: DataCategory.IDENTIFICATION, score: 52, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Compliance Audit Trail", path: "https://acme-corp.sharepoint.com/sites/Compliance/AuditReports", cat: DataCategory.OTHER, score: 38, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Marketing Assets", path: "https://acme-corp.sharepoint.com/sites/Marketing/Campaigns", cat: DataCategory.OTHER, score: 12, personal: false, special: false },
    { sysLabel: "SharePoint", name: "IT Knowledge Base", path: "https://acme-corp.sharepoint.com/sites/IT/KnowledgeBase", cat: DataCategory.OTHER, score: 10, personal: false, special: false },
    { sysLabel: "SharePoint", name: "DSAR Response Archive", path: "https://acme-corp.sharepoint.com/sites/Legal/DSAR-Archive", cat: DataCategory.IDENTIFICATION, score: 88, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Employee Health & Safety", path: "https://acme-corp.sharepoint.com/sites/HR/HealthSafety", cat: DataCategory.HEALTH, score: 90, personal: true, special: true },
    { sysLabel: "SharePoint", name: "Project Management Hub", path: "https://acme-corp.sharepoint.com/sites/PMO/Projects", cat: DataCategory.OTHER, score: 18, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Training Certificates", path: "https://acme-corp.sharepoint.com/sites/HR/Training/Certificates", cat: DataCategory.HR, score: 32, personal: true, special: false },
    { sysLabel: "SharePoint", name: "Whistleblower Reports", path: "https://acme-corp.sharepoint.com/sites/Compliance/Whistleblower", cat: DataCategory.OTHER_SPECIAL_CATEGORY, score: 98, personal: true, special: true },
    // ── Fileserver assets (20) — UNC paths ───────────────────────────────
    { sysLabel: "Fileserver", name: "HR Contracts", path: "\\\\fs01\\HR\\Contracts\\*", cat: DataCategory.HR, score: 90, personal: true, special: true },
    { sysLabel: "Fileserver", name: "HR Payroll Reports", path: "\\\\fs01\\HR\\Payroll\\monthly-reports\\*", cat: DataCategory.PAYMENT, score: 92, personal: true, special: false },
    { sysLabel: "Fileserver", name: "HR Performance Reviews", path: "\\\\fs01\\HR\\Reviews\\2025\\*", cat: DataCategory.HR, score: 88, personal: true, special: false },
    { sysLabel: "Fileserver", name: "HR Onboarding Docs", path: "\\\\fs01\\HR\\Onboarding\\NewHires-2025\\*", cat: DataCategory.IDENTIFICATION, score: 85, personal: true, special: false },
    { sysLabel: "Fileserver", name: "HR Medical Certificates", path: "\\\\fs01\\HR\\Medical\\Certificates\\*", cat: DataCategory.HEALTH, score: 96, personal: true, special: true },
    { sysLabel: "Fileserver", name: "HR Exit Interviews", path: "\\\\fs01\\HR\\Offboarding\\ExitInterviews\\*", cat: DataCategory.HR, score: 78, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Finance Invoices", path: "\\\\fs01\\Finance\\Invoices\\*", cat: DataCategory.PAYMENT, score: 55, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Finance Tax Records", path: "\\\\fs01\\Finance\\Tax\\*", cat: DataCategory.CREDITWORTHINESS, score: 72, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Finance Payslips Archive", path: "\\\\fs01\\Finance\\Payslips\\2024-2025\\*", cat: DataCategory.PAYMENT, score: 94, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Finance Expense Receipts", path: "\\\\fs01\\Finance\\Expenses\\Receipts\\*", cat: DataCategory.PAYMENT, score: 48, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Legal NDAs", path: "\\\\fs01\\Legal\\NDAs\\*", cat: DataCategory.CONTRACT, score: 35, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Legal DSAR Responses", path: "\\\\fs01\\Legal\\DSAR-Responses\\2025\\*", cat: DataCategory.IDENTIFICATION, score: 87, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Marketing Customer Lists", path: "\\\\fs01\\Marketing\\CustomerLists\\*", cat: DataCategory.CONTACT, score: 71, personal: true, special: false },
    { sysLabel: "Fileserver", name: "IT Access Logs", path: "\\\\fs01\\IT\\Logs\\AccessAudit\\*", cat: DataCategory.ONLINE_TECHNICAL, score: 38, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Shared Departmental", path: "\\\\fs01\\Shared\\Departments\\*", cat: DataCategory.OTHER, score: 25, personal: false, special: false },
    { sysLabel: "Fileserver", name: "Customer Correspondence", path: "\\\\fs01\\Sales\\Correspondence\\*", cat: DataCategory.COMMUNICATION, score: 68, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Employee Photos", path: "\\\\fs01\\HR\\Photos\\*", cat: DataCategory.IDENTIFICATION, score: 80, personal: true, special: true },
    { sysLabel: "Fileserver", name: "Board Meeting Minutes", path: "\\\\fs01\\Executive\\BoardMinutes\\*", cat: DataCategory.HR, score: 65, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Vendor Due Diligence", path: "\\\\fs01\\Procurement\\VendorDD\\*", cat: DataCategory.IDENTIFICATION, score: 52, personal: true, special: false },
    { sysLabel: "Fileserver", name: "Customer PO Archive", path: "\\\\fs01\\Sales\\PurchaseOrders\\Archive\\*", cat: DataCategory.CONTRACT, score: 42, personal: true, special: false },
  ];
  console.log(`Defined ${assetDefs.length} data asset templates`);

  const sysLookup: Record<string, string> = {};
  for (const s of mvpSystems) sysLookup[s.label] = s.sys.id;

  // Use createMany in batches for performance
  const BATCH_SIZE = 200;
  const assetRecords = assetDefs.map((a) => ({
    tenantId: tenant.id,
    systemId: sysLookup[a.sysLabel],
    name: a.name,
    path: a.path,
    dataCategory: a.cat,
    sensitivityScore: a.score,
    personalData: a.personal,
    specialCategory: a.special,
    lastScannedAt: daysAgo(randInt(1, 30)),  // spread over last 30 days
  }));

  for (let i = 0; i < assetRecords.length; i += BATCH_SIZE) {
    await prisma.dataAsset.createMany({ data: assetRecords.slice(i, i + BATCH_SIZE) });
  }
  // Retrieve created assets for FK references
  const createdAssets = await prisma.dataAsset.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Created ${createdAssets.length} data assets across ${mvpSystems.length} systems`);

  // ── Scan Jobs (1 completed per system + 1 running) ────────────────────────
  const scanJobRecords = mvpSystems.map(({ sys, label }) => ({
    tenantId: tenant.id,
    systemId: sys.id,
    status: ScanJobStatus.COMPLETED as ScanJobStatus,
    assetsScanned: assetDefs.filter(a => a.sysLabel === label).length,
    findingsCount: randInt(20, 60),
    startedAt: daysAgo(3),
    completedAt: daysAgo(3),
  }));
  await prisma.scanJob.createMany({ data: scanJobRecords });
  // One running scan
  await prisma.scanJob.create({
    data: {
      tenantId: tenant.id,
      systemId: m365System.id,
      status: ScanJobStatus.RUNNING,
      assetsScanned: 5,
      findingsCount: 12,
      startedAt: new Date(),
    },
  });
  console.log("Created scan jobs");

  // ── Findings (500 total) ──────────────────────────────────────────────────
  // Distribution: ~70% green (0-39), ~25% yellow (40-69), ~5% red (70-100)
  // Each system guaranteed at least a few red findings for heatmap visibility.

  const findingCategories: DataCategory[] = [
    DataCategory.IDENTIFICATION, DataCategory.CONTACT, DataCategory.CONTRACT,
    DataCategory.PAYMENT, DataCategory.COMMUNICATION, DataCategory.HR,
    DataCategory.ONLINE_TECHNICAL, DataCategory.HEALTH, DataCategory.CREDITWORTHINESS,
  ];

  type PiiCategory = "EMAIL" | "PHONE" | "ADDRESS" | "IBAN" | "ID_DOC" | "HEALTH" | "HR" | "PAYMENT" | "CUSTOMER_ID";

  const piiCategoryMap: Record<string, PiiCategory[]> = {
    IDENTIFICATION: ["EMAIL", "ID_DOC", "CUSTOMER_ID"],
    CONTACT: ["EMAIL", "PHONE", "ADDRESS"],
    CONTRACT: ["EMAIL", "ADDRESS", "ID_DOC"],
    PAYMENT: ["IBAN", "PAYMENT", "ADDRESS"],
    COMMUNICATION: ["EMAIL", "PHONE"],
    HR: ["EMAIL", "HR", "ID_DOC"],
    ONLINE_TECHNICAL: ["EMAIL", "CUSTOMER_ID"],
    HEALTH: ["HEALTH", "EMAIL", "ID_DOC"],
    CREDITWORTHINESS: ["IBAN", "PAYMENT", "ADDRESS"],
  };

  const sampleRedactedTexts: Record<PiiCategory, string[]> = {
    EMAIL: [
      "Contact: j***.s****@example.com",
      "Sent to: m.m*****@acme-corp.com",
      "CC: h****@partner.org",
      "From: d****@gmail.com",
    ],
    PHONE: [
      "Mobile: +49-170-***-**42",
      "Tel: +44-20-****-8891",
      "Phone: (030) ***-**67",
      "Fax: +1-555-***-0012",
    ],
    ADDRESS: [
      "Address: M*****str. 12, 8***0 München",
      "Ship to: 42 O***** Road, London SW** 1AA",
      "Billing: P.O. Box ***, 1**** Berlin",
    ],
    IBAN: [
      "IBAN: DE89 3704 **** **** **** 00",
      "Account: GB29 NWBK ****  **** ****  26",
      "IBAN: FR76 3000 **** **** **** **** R06",
    ],
    HEALTH: [
      "Diagnosis: [REDACTED medical condition]",
      "Medical cert: inability to work from **/**/2025",
      "Disability status: [REDACTED]",
    ],
    HR: [
      "Performance rating: [REDACTED] — needs improvement note",
      "Salary band: €**,000 – €**,000 gross/year",
      "Disciplinary note: verbal warning issued **/**/2025",
    ],
    ID_DOC: [
      "Passport: X*****789, issued by [REDACTED]",
      "National ID: ****-****-1234",
      "Driver licence: B-*****-****-25",
    ],
    PAYMENT: [
      "Card ending ****-4532",
      "VISA ****-****-****-8901",
      "Direct debit ref: DD-****-7890",
    ],
    CUSTOMER_ID: [
      "Customer ID: CUST-*****-42",
      "Account ref: ACC-****-9012",
      "Member no.: M-*****-001",
    ],
  };

  const findingSummaries: Record<string, string[]> = {
    IDENTIFICATION: [
      "Full name and date of birth found in document metadata",
      "National ID number detected in scanned PDF",
      "Employee photo with EXIF data containing GPS coordinates",
      "Passport scan stored unencrypted in shared folder",
      "Employee ID badge images with full name visible",
      "Scanned ID documents in recruiting folder without encryption",
    ],
    CONTACT: [
      "Personal email addresses in marketing distribution list",
      "Home address and phone number in CRM contact card",
      "Mobile phone numbers in unprotected CSV export",
      "Personal email in automated notification templates",
      "Private mobile numbers stored in shared contact list",
      "Emergency contact details accessible to all team members",
    ],
    CONTRACT: [
      "Customer contract with embedded personal identifiers",
      "Service agreement containing home address",
      "Vendor NDA with personal guarantor details",
      "Signed contract PDF with embedded personal signature",
    ],
    PAYMENT: [
      "IBAN and bank details in payroll spreadsheet",
      "Credit card last-4 digits in support ticket",
      "Invoice with personal billing address",
      "Salary information in shared team folder",
      "Bank account details in vendor onboarding form",
      "Payslip PDF with full IBAN visible in filename",
    ],
    COMMUNICATION: [
      "Personal correspondence in shared mailbox",
      "Sensitive HR discussion in email thread",
      "Customer complaint containing health information",
      "Internal chat messages with personal opinions",
      "Private Slack DMs exported to shared drive",
    ],
    HR: [
      "Performance review with subjective assessments",
      "Disciplinary record in manager's OneDrive",
      "Sick leave records in HR shared folder",
      "Job application with personal references",
      "Salary negotiation emails in shared mailbox",
      "Probation period evaluation with personal comments",
    ],
    ONLINE_TECHNICAL: [
      "IP addresses in application access logs",
      "Browser fingerprint data in analytics",
      "Device identifiers in mobile app telemetry",
      "Session cookies with user tracking data",
    ],
    HEALTH: [
      "Medical certificate uploaded to HR portal",
      "Disability accommodation request in HR system",
      "Health insurance enrollment details",
      "Sick note with diagnosis code in HR folder",
    ],
    CREDITWORTHINESS: [
      "Credit check results in vendor onboarding folder",
      "Financial assessment in customer file",
      "Bank statement copies in loan application folder",
    ],
  };

  // Create a copilot run for discovery findings (FK dependency)
  const mvpCopilotRun = await prisma.copilotRun.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      createdByUserId: admin.id,
      status: CopilotRunStatus.COMPLETED,
      justification: "Enterprise discovery scan — full data inventory analysis",
      scopeSummary: "All systems — M365, Exchange, SharePoint, Fileserver",
      totalFindings: 500,
      totalEvidenceItems: 0,
      startedAt: daysAgo(5),
      completedAt: daysAgo(5),
    },
  });

  const specialCategories: DataCategory[] = [
    DataCategory.HEALTH, DataCategory.UNION, DataCategory.RELIGION,
    DataCategory.POLITICAL_OPINION, DataCategory.OTHER_SPECIAL_CATEGORY,
  ];

  // Pre-build finding data, then createMany in batches
  const TOTAL_FINDINGS = 500;
  // Guarantee at least 3 red findings per system
  const guaranteedRedPerSystem = 3;
  const guaranteedRedTotal = mvpSystems.length * guaranteedRedPerSystem;
  const remainingCount = TOTAL_FINDINGS - guaranteedRedTotal;

  interface FindingRecord {
    tenantId: string; caseId: string; runId: string;
    dataCategory: DataCategory; severity: FindingSeverity;
    confidence: number; summary: string; evidenceItemIds: string[];
    containsSpecialCategory: boolean; containsThirdPartyDataSuspected: boolean;
    requiresLegalReview: boolean; systemId: string; riskScore: number;
    status: FindingStatus; dataAssetLocation: string | null;
    sampleRedacted: string | null; createdAt: Date;
  }

  const findingRecords: FindingRecord[] = [];

  // Helper: build one finding record
  function buildFinding(sysIdx: number, forceRed: boolean): FindingRecord {
    const roll = rng();
    let riskScore: number;
    let severity: FindingSeverity;

    if (forceRed) {
      riskScore = randInt(70, 100);
      severity = FindingSeverity.CRITICAL;
    } else if (roll < 0.70) {
      riskScore = randInt(0, 39);
      severity = FindingSeverity.INFO;
    } else if (roll < 0.95) {
      riskScore = randInt(40, 69);
      severity = FindingSeverity.WARNING;
    } else {
      riskScore = randInt(70, 100);
      severity = FindingSeverity.CRITICAL;
    }

    const cat = pick(findingCategories);
    const catKey = cat as string;
    const summaries = findingSummaries[catKey] || [`${catKey} data detected in system asset`];
    const summary = pick(summaries);
    const isSpecial = specialCategories.includes(cat);

    const statusRoll = rng();
    const status: FindingStatus = statusRoll < 0.4
      ? FindingStatus.NEW
      : statusRoll < 0.7
        ? FindingStatus.ACCEPTED
        : FindingStatus.MITIGATED;

    const sys = mvpSystems[sysIdx];
    const sysAssets = assetDefs.filter(a => a.sysLabel === sys.label);
    const assetPath = sysAssets.length > 0 ? pick(sysAssets).path : null;

    // Pick realistic PII sample
    const piiCats = piiCategoryMap[catKey] || ["EMAIL"];
    const piiCat = pick(piiCats);
    const samples = sampleRedactedTexts[piiCat];
    const sampleRedacted = riskScore >= 30 ? pick(samples) : null;

    // Spread createdAt over last 90 days
    const createdAt = daysAgo(randInt(0, 90));

    return {
      tenantId: tenant.id,
      caseId: allCases[randInt(0, allCases.length - 1)].id,
      runId: mvpCopilotRun.id,
      dataCategory: cat,
      severity,
      confidence: parseFloat((0.5 + rng() * 0.5).toFixed(3)),
      summary,
      evidenceItemIds: [],
      containsSpecialCategory: isSpecial,
      containsThirdPartyDataSuspected: rng() < 0.1,
      requiresLegalReview: riskScore >= 70,
      systemId: sys.sys.id,
      riskScore,
      status,
      dataAssetLocation: assetPath,
      sampleRedacted,
      createdAt,
    };
  }

  // 1) Guaranteed red findings per system
  for (let sIdx = 0; sIdx < mvpSystems.length; sIdx++) {
    for (let r = 0; r < guaranteedRedPerSystem; r++) {
      findingRecords.push(buildFinding(sIdx, true));
    }
  }

  // 2) Remaining findings spread across systems
  for (let i = 0; i < remainingCount; i++) {
    findingRecords.push(buildFinding(i % mvpSystems.length, false));
  }

  // Shuffle for natural ordering
  shuffle(findingRecords);

  // createMany in batches
  for (let i = 0; i < findingRecords.length; i += BATCH_SIZE) {
    await prisma.finding.createMany({ data: findingRecords.slice(i, i + BATCH_SIZE) });
  }

  // Retrieve created findings for FK references
  const mvpFindings = await prisma.finding.findMany({
    where: { tenantId: tenant.id, runId: mvpCopilotRun.id },
    select: { id: true, caseId: true, systemId: true, summary: true, dataAssetLocation: true, dataCategory: true, riskScore: true },
  });

  // Count distribution for logging
  const greenCount = mvpFindings.filter(f => f.riskScore < 40).length;
  const yellowCount = mvpFindings.filter(f => f.riskScore >= 40 && f.riskScore < 70).length;
  const redCount = mvpFindings.filter(f => f.riskScore >= 70).length;
  console.log(`Created ${mvpFindings.length} findings (green=${greenCount}, yellow=${yellowCount}, red=${redCount})`);

  // ── DSAR Case Items (link cases to findings) ─────────────────────────────
  let caseItemCount = 0;
  const caseItemRecords = [];
  for (const c of allCases) {
    const relatedFindings = mvpFindings.filter(f => f.caseId === c.id);
    const itemCount = Math.min(relatedFindings.length, randInt(3, 8));

    for (let j = 0; j < itemCount; j++) {
      const f = relatedFindings[j];
      const decisionRoll = rng();
      const decision = j < 2 ? CaseItemDecision.INCLUDED : (decisionRoll < 0.3 ? CaseItemDecision.EXCLUDED : CaseItemDecision.PROPOSED);

      caseItemRecords.push({
        tenantId: tenant.id,
        caseId: c.id,
        findingId: f.id,
        systemId: f.systemId,
        assetType: "finding",
        title: f.summary,
        location: f.dataAssetLocation,
        dataCategory: f.dataCategory,
        riskScore: f.riskScore,
        decision,
        decisionReason: decision === CaseItemDecision.EXCLUDED ? "Not relevant to data subject" : null,
        decidedByUserId: decision !== CaseItemDecision.PROPOSED ? dpo.id : null,
        decidedAt: decision !== CaseItemDecision.PROPOSED ? daysAgo(randInt(0, 5)) : null,
        matchScore: parseFloat((0.5 + rng() * 0.5).toFixed(3)),
      });
      caseItemCount++;
    }
  }

  for (let i = 0; i < caseItemRecords.length; i += BATCH_SIZE) {
    await prisma.dsarCaseItem.createMany({ data: caseItemRecords.slice(i, i + BATCH_SIZE) });
  }
  console.log(`Created ${caseItemCount} DSAR case items`);

  // ── DSAR Audit Events ─────────────────────────────────────────────────────
  const auditActions = ["case.created", "case.viewed", "case.status_changed", "case.assigned", "finding.reviewed", "case_item.decided", "export.requested"];
  const auditRecords = [];
  for (const c of allCases.slice(0, 10)) {
    const numEvents = randInt(3, 7);
    for (let k = 0; k < numEvents; k++) {
      auditRecords.push({
        tenantId: tenant.id,
        caseId: c.id,
        actorUserId: [admin.id, dpo.id, caseManager.id][k % 3],
        action: auditActions[k % auditActions.length],
        entityType: "DSARCase",
        entityId: c.id,
        details: { timestamp: daysAgo(randInt(0, 20)).toISOString() },
      });
    }
  }
  await prisma.dsarAuditEvent.createMany({ data: auditRecords });
  console.log(`Created ${auditRecords.length} DSAR audit events`);

  console.log("\n═══ Discovery & Scan seed complete ═══");
  console.log(`Summary: ${allCases.length} cases, ${createdAssets.length} data assets, ${mvpFindings.length} findings, ${caseItemCount} case items`);
  console.log(`Findings distribution: ${greenCount} green (${(greenCount/mvpFindings.length*100).toFixed(0)}%), ${yellowCount} yellow (${(yellowCount/mvpFindings.length*100).toFixed(0)}%), ${redCount} red (${(redCount/mvpFindings.length*100).toFixed(0)}%)`);

  // ── DB-verified counts ──────────────────────────────────────────────────────
  const assetCount = await prisma.dataAsset.count();
  const findingCount = await prisma.finding.count();
  console.log("\n═══ DB-Verified Counts ═══");
  console.log(`Assets: ${assetCount}`);
  console.log(`Findings: ${findingCount}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
