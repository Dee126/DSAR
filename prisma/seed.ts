import { PrismaClient, UserRole, DSARType, CaseStatus, CasePriority, TaskStatus, CopilotRunStatus, CopilotQueryStatus, FindingSeverity, DataCategory } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data (order matters for FK constraints)
  await prisma.detectorResult.deleteMany();
  await prisma.finding.deleteMany();
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

  // Create systems (processor map)
  const crmSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id,
      name: "CRM System",
      description: "Customer relationship management - Salesforce",
      owner: "Sales Department",
      contactEmail: "crm-admin@acme-corp.com",
      tags: ["customer-data", "salesforce"],
    },
  });

  const hrSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id,
      name: "HR Platform",
      description: "Employee data management - Workday",
      owner: "Human Resources",
      contactEmail: "hr-admin@acme-corp.com",
      tags: ["employee-data", "workday"],
    },
  });

  const analyticsSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id,
      name: "Analytics Platform",
      description: "User behavior analytics - Mixpanel",
      owner: "Product Team",
      contactEmail: "analytics@acme-corp.com",
      tags: ["analytics", "behavioral-data"],
    },
  });

  const emailSystem = await prisma.system.create({
    data: {
      tenantId: tenant.id,
      name: "Email Marketing",
      description: "Email marketing platform - Mailchimp",
      owner: "Marketing Team",
      contactEmail: "marketing@acme-corp.com",
      tags: ["marketing", "email", "consent"],
    },
  });

  console.log("Created 4 systems");

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

  // CopilotRun for case1 (John Smith access request, DATA_COLLECTION stage)
  const copilotRun1 = await prisma.copilotRun.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      createdByUserId: caseManager.id,
      status: CopilotRunStatus.COMPLETED,
      reason: "DSAR fulfillment — automated data discovery for personal data access request",
      summary: [
        "=== Discovery Run Summary ===",
        "",
        "Subject Identity:",
        `  Primary email: ${subject1.email}`,
        `  Name: ${subject1.fullName}`,
        "  Known identifiers: 3",
        "  Systems resolved: 2",
        "",
        "Overview:",
        "  Total findings: 3",
        "  Total records: 7",
        "  Sources queried: 2",
        "  Data categories found: IDENTIFICATION, CONTACT, COMMUNICATION, HR_EMPLOYMENT",
        "",
        "Findings by Source:",
        "  M365:",
        "    Findings: 1, Records: 1",
        "    - M365 user profile found (1 record)",
        "  EXCHANGE_ONLINE:",
        "    Findings: 2, Records: 6",
        "    - Exchange emails containing personal data (5 records)",
        "    - HR data found in email attachments (1 record)",
      ].join("\n"),
      totalFindings: 3,
      art9Flagged: false,
      identityGraph: {
        primaryEmail: subject1.email,
        primaryName: subject1.fullName,
        identifiers: [
          { type: "email", value: subject1.email, source: "data_subject", confidence: 1.0 },
          { type: "name", value: subject1.fullName, source: "data_subject", confidence: 1.0 },
          { type: "upn", value: "john.smith@acme-corp.com", source: "M365", confidence: 0.95 },
        ],
        resolvedSystems: [
          { provider: "M365", accountId: "m365-user-guid-001", displayName: "Acme Corp M365" },
          { provider: "EXCHANGE_ONLINE", accountId: "exo-mailbox-guid-001", displayName: "Acme Exchange" },
        ],
      },
      startedAt: daysAgo(9),
      completedAt: daysAgo(9),
    },
  });

  // CopilotQuery records linked to the run
  const copilotQueryM365 = await prisma.copilotQuery.create({
    data: {
      tenantId: tenant.id,
      runId: copilotRun1.id,
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
      runId: copilotRun1.id,
      integrationId: exchangeIntegration.id,
      provider: "EXCHANGE_ONLINE",
      querySpec: {
        subjectIdentifiers: { primary: { type: "email", value: subject1.email }, alternatives: [] },
        searchTerms: { terms: ["john smith", "john.smith"], matchType: "contains" },
        providerScope: { mailboxes: [subject1.email], folderScope: "all", includeAttachments: true },
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

  // Findings linked to the run
  const finding1 = await prisma.finding.create({
    data: {
      tenantId: tenant.id,
      runId: copilotRun1.id,
      queryId: copilotQueryM365.id,
      source: "M365",
      location: "M365:Acme Corp M365",
      title: "M365 user profile found",
      description: "Entra ID user profile containing display name, email, department, and job title.",
      dataCategories: [DataCategory.IDENTIFICATION, DataCategory.CONTACT],
      severity: FindingSeverity.MEDIUM,
      isArt9: false,
      art9Categories: [],
      recordCount: 1,
      metadata: {
        userPrincipalName: "john.smith@acme-corp.com",
        department: "Engineering",
        jobTitle: "Software Developer",
      },
    },
  });

  const finding2 = await prisma.finding.create({
    data: {
      tenantId: tenant.id,
      runId: copilotRun1.id,
      queryId: copilotQueryExchange.id,
      source: "EXCHANGE_ONLINE",
      location: "EXCHANGE_ONLINE:Acme Exchange",
      title: "Exchange emails containing personal data",
      description: "Mailbox search returned 5 emails containing personal identifiers including email addresses and a phone number.",
      dataCategories: [DataCategory.COMMUNICATION, DataCategory.CONTACT],
      severity: FindingSeverity.MEDIUM,
      isArt9: false,
      art9Categories: [],
      recordCount: 5,
      metadata: {
        mailbox: subject1.email,
        folderScope: "all",
        matchedFolders: ["Inbox", "Sent Items"],
      },
    },
  });

  const finding3 = await prisma.finding.create({
    data: {
      tenantId: tenant.id,
      runId: copilotRun1.id,
      queryId: copilotQueryExchange.id,
      source: "EXCHANGE_ONLINE",
      location: "EXCHANGE_ONLINE:Acme Exchange",
      title: "HR data found in email attachments",
      description: "Email attachment contains salary information and employment contract details for the data subject.",
      dataCategories: [DataCategory.HR_EMPLOYMENT],
      severity: FindingSeverity.HIGH,
      isArt9: false,
      art9Categories: [],
      recordCount: 1,
      metadata: {
        mailbox: subject1.email,
        attachmentType: "xlsx",
        attachmentName: "Q4_Compensation_Review.xlsx",
      },
    },
  });

  // DetectorResult records for findings
  // Finding 1: EMAIL detector
  await prisma.detectorResult.create({
    data: {
      tenantId: tenant.id,
      findingId: finding1.id,
      detectorType: "regex",
      patternName: "EMAIL",
      matchCount: 2,
      sampleMatch: "j***@acme-corp.com",
      confidence: 0.9,
    },
  });

  // Finding 2: EMAIL detector + PHONE detector
  await prisma.detectorResult.create({
    data: {
      tenantId: tenant.id,
      findingId: finding2.id,
      detectorType: "regex",
      patternName: "EMAIL",
      matchCount: 5,
      sampleMatch: "j***@acme-corp.com",
      confidence: 0.85,
    },
  });

  await prisma.detectorResult.create({
    data: {
      tenantId: tenant.id,
      findingId: finding2.id,
      detectorType: "regex",
      patternName: "PHONE",
      matchCount: 1,
      sampleMatch: "+49 *****42",
      confidence: 0.75,
    },
  });

  // Finding 3: IBAN detector (NOT art9)
  await prisma.detectorResult.create({
    data: {
      tenantId: tenant.id,
      findingId: finding3.id,
      detectorType: "regex",
      patternName: "IBAN",
      matchCount: 1,
      sampleMatch: "DE******0000",
      confidence: 0.8,
    },
  });

  // IdentityProfile for case1
  await prisma.identityProfile.create({
    data: {
      tenantId: tenant.id,
      caseId: case1.id,
      runId: copilotRun1.id,
      primaryEmail: subject1.email,
      primaryName: subject1.fullName,
      identifiers: [
        { type: "email", value: subject1.email, source: "data_subject", confidence: 1.0 },
        { type: "name", value: subject1.fullName, source: "data_subject", confidence: 1.0 },
        { type: "upn", value: "john.smith@acme-corp.com", source: "M365", confidence: 0.95 },
      ],
      resolvedSystems: [
        { provider: "M365", accountId: "m365-user-guid-001", displayName: "Acme Corp M365" },
        { provider: "EXCHANGE_ONLINE", accountId: "exo-mailbox-guid-001", displayName: "Acme Exchange" },
      ],
      confidence: 0.95,
    },
  });

  console.log("Created copilot demo data (1 run, 2 queries, 3 findings, 4 detector results, 1 identity profile)");

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
  console.log(`Copilot Runs: 1 (COMPLETED, 3 findings)`);
  console.log(`Copilot Queries: 2 (M365, Exchange)`);
  console.log(`Findings: 3 (with 4 detector results)`);
  console.log(`Identity Profiles: 1`);
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
