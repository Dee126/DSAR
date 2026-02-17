import { NextResponse } from "next/server";
import { PrismaClient, UserRole, DSARType, CaseStatus, CasePriority, TaskStatus } from "@prisma/client";
import { hash } from "bcryptjs";

export async function POST() {
  try {
    const prisma = new PrismaClient();

    // Check if data already exists
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      await prisma.$disconnect();
      return NextResponse.json(
        { message: "Database already seeded", userCount: existingUsers },
        { status: 200 }
      );
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: "Acme Corp",
        slaDefaultDays: 30,
      },
    });

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

    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "viewer@acme-corp.com",
        name: "Vera Viewer",
        passwordHash,
        role: UserRole.READ_ONLY,
      },
    });

    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "daniel.schormann@gmail.com",
        name: "Daniel Schormann",
        passwordHash: danielPasswordHash,
        role: UserRole.TENANT_ADMIN,
      },
    });

    // Create systems
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

    // Create data subjects
    const subject1 = await prisma.dataSubject.create({
      data: {
        tenantId: tenant.id,
        fullName: "John Smith",
        email: "john.smith@example.com",
        phone: "+1-555-0101",
        address: "123 Main St, Springfield, IL 62701",
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
      },
    });

    const subject3 = await prisma.dataSubject.create({
      data: {
        tenantId: tenant.id,
        fullName: "Robert Johnson",
        email: "rjohnson@example.com",
        phone: "+1-555-0103",
      },
    });

    const subject4 = await prisma.dataSubject.create({
      data: {
        tenantId: tenant.id,
        fullName: "Emily Chen",
        email: "emily.chen@example.com",
      },
    });

    // Helper for dates
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
        dataSubjectId: subject2.id,
        createdByUserId: caseManager.id,
        assignedToUserId: dpo.id,
      },
    });

    await prisma.dSARCase.create({
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

    await prisma.dSARCase.create({
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

    // State transitions
    await prisma.dSARStateTransition.createMany({
      data: [
        {
          tenantId: tenant.id, caseId: case1.id,
          fromStatus: CaseStatus.NEW, toStatus: CaseStatus.IDENTITY_VERIFICATION,
          changedByUserId: admin.id, changedAt: daysAgo(14),
          reason: "Identity documents requested from subject",
        },
        {
          tenantId: tenant.id, caseId: case1.id,
          fromStatus: CaseStatus.IDENTITY_VERIFICATION, toStatus: CaseStatus.INTAKE_TRIAGE,
          changedByUserId: admin.id, changedAt: daysAgo(12),
          reason: "Identity verified via passport copy",
        },
        {
          tenantId: tenant.id, caseId: case1.id,
          fromStatus: CaseStatus.INTAKE_TRIAGE, toStatus: CaseStatus.DATA_COLLECTION,
          changedByUserId: caseManager.id, changedAt: daysAgo(10),
          reason: "Triage complete. Assigned to data collection across CRM and Analytics.",
        },
      ],
    });

    await prisma.dSARStateTransition.createMany({
      data: [
        {
          tenantId: tenant.id, caseId: case2.id,
          fromStatus: CaseStatus.NEW, toStatus: CaseStatus.INTAKE_TRIAGE,
          changedByUserId: caseManager.id, changedAt: daysAgo(24),
          reason: "Erasure request triaged - high impact",
        },
        {
          tenantId: tenant.id, caseId: case2.id,
          fromStatus: CaseStatus.INTAKE_TRIAGE, toStatus: CaseStatus.DATA_COLLECTION,
          changedByUserId: caseManager.id, changedAt: daysAgo(20),
          reason: "Collecting data locations across all systems",
        },
        {
          tenantId: tenant.id, caseId: case2.id,
          fromStatus: CaseStatus.DATA_COLLECTION, toStatus: CaseStatus.REVIEW_LEGAL,
          changedByUserId: caseManager.id, changedAt: daysAgo(10),
          reason: "Data mapping complete. Legal review needed for retention exceptions.",
        },
      ],
    });

    await prisma.dSARStateTransition.createMany({
      data: [
        {
          tenantId: tenant.id, caseId: case5.id,
          fromStatus: CaseStatus.NEW, toStatus: CaseStatus.IDENTITY_VERIFICATION,
          changedByUserId: admin.id, changedAt: daysAgo(38),
          reason: "Requesting identity verification",
        },
        {
          tenantId: tenant.id, caseId: case5.id,
          fromStatus: CaseStatus.IDENTITY_VERIFICATION, toStatus: CaseStatus.REJECTED,
          changedByUserId: dpo.id, changedAt: daysAgo(35),
          reason: "Unable to verify identity. Requester could not provide sufficient identification.",
        },
      ],
    });

    // Tasks
    await prisma.task.createMany({
      data: [
        {
          tenantId: tenant.id, caseId: case1.id,
          title: "Extract CRM records for John Smith",
          description: "Pull all customer records from Salesforce CRM",
          status: TaskStatus.IN_PROGRESS,
          assigneeUserId: contributor.id, dueDate: daysFromNow(5),
          systemId: crmSystem.id,
        },
        {
          tenantId: tenant.id, caseId: case1.id,
          title: "Extract analytics data",
          description: "Export behavioral data from Mixpanel for this user",
          status: TaskStatus.OPEN,
          assigneeUserId: contributor.id, dueDate: daysFromNow(7),
          systemId: analyticsSystem.id,
        },
        {
          tenantId: tenant.id, caseId: case1.id,
          title: "Check HR records",
          description: "Verify if subject has any employee records",
          status: TaskStatus.DONE,
          assigneeUserId: caseManager.id, dueDate: daysAgo(3),
          systemId: hrSystem.id,
        },
      ],
    });

    await prisma.task.createMany({
      data: [
        {
          tenantId: tenant.id, caseId: case2.id,
          title: "Legal review: retention requirements",
          description: "Check if any legal retention obligations prevent erasure",
          status: TaskStatus.IN_PROGRESS,
          assigneeUserId: dpo.id, dueDate: daysFromNow(2),
        },
        {
          tenantId: tenant.id, caseId: case2.id,
          title: "Prepare erasure plan",
          description: "Document which systems need data deleted and the order of operations",
          status: TaskStatus.BLOCKED,
          assigneeUserId: caseManager.id, dueDate: daysFromNow(4),
        },
      ],
    });

    // Comments
    await prisma.comment.createMany({
      data: [
        {
          tenantId: tenant.id, caseId: case1.id, authorUserId: admin.id,
          body: "Case opened. Subject provided clear identification. Proceeding with standard access request workflow.",
          createdAt: daysAgo(14),
        },
        {
          tenantId: tenant.id, caseId: case1.id, authorUserId: caseManager.id,
          body: "Data collection in progress. CRM extraction started. Analytics team notified.",
          createdAt: daysAgo(9),
        },
        {
          tenantId: tenant.id, caseId: case1.id, authorUserId: contributor.id,
          body: "HR records checked - no employee data found for this subject. Marking HR task as done.",
          createdAt: daysAgo(5),
        },
        {
          tenantId: tenant.id, caseId: case2.id, authorUserId: dpo.id,
          body: "This is a complex erasure case. We need to verify retention obligations under financial regulations before proceeding.",
          createdAt: daysAgo(10),
        },
        {
          tenantId: tenant.id, caseId: case2.id, authorUserId: caseManager.id,
          body: "Data mapping complete. Found data in CRM, Analytics, and backup systems. Awaiting legal clearance.",
          createdAt: daysAgo(8),
        },
      ],
    });

    // Audit logs
    await prisma.auditLog.createMany({
      data: [
        {
          tenantId: tenant.id, actorUserId: admin.id, action: "LOGIN",
          entityType: "User", entityId: admin.id, details: { method: "credentials" },
        },
        {
          tenantId: tenant.id, actorUserId: admin.id, action: "CREATE",
          entityType: "DSARCase", entityId: case1.id,
          details: { caseNumber: case1.caseNumber, type: "ACCESS" },
        },
        {
          tenantId: tenant.id, actorUserId: caseManager.id, action: "STATUS_TRANSITION",
          entityType: "DSARCase", entityId: case1.id,
          details: { from: "INTAKE_TRIAGE", to: "DATA_COLLECTION" },
        },
        {
          tenantId: tenant.id, actorUserId: admin.id, action: "CREATE",
          entityType: "DSARCase", entityId: case2.id,
          details: { caseNumber: case2.caseNumber, type: "ERASURE" },
        },
        {
          tenantId: tenant.id, actorUserId: dpo.id, action: "STATUS_TRANSITION",
          entityType: "DSARCase", entityId: case5.id,
          details: { from: "IDENTITY_VERIFICATION", to: "REJECTED" },
        },
      ],
    });

    await prisma.$disconnect();

    return NextResponse.json({
      message: "Database seeded successfully",
      data: {
        tenant: "Acme Corp",
        users: 6,
        systems: 3,
        dataSubjects: 4,
        cases: 5,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seeding failed", details: String(error) },
      { status: 500 }
    );
  }
}
