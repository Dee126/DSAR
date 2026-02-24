import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  FindingSeverity,
  FindingStatus,
  DataCategory,
  ConnectorType,
  SystemCriticality,
} from "@prisma/client";

export const dynamic = "force-dynamic";

const DEMO_TAG = "[DEMO]";

const DEMO_SYSTEMS: {
  name: string;
  connectorType: ConnectorType;
  description: string;
  criticality: SystemCriticality;
  containsSpecialCategories: boolean;
}[] = [
  {
    name: "HR Core (Workday)",
    connectorType: "CUSTOM",
    description: `${DEMO_TAG} Central HR system — employee master data`,
    criticality: "HIGH",
    containsSpecialCategories: true,
  },
  {
    name: "Finance ERP (SAP)",
    connectorType: "CUSTOM",
    description: `${DEMO_TAG} Financial records — payroll, billing, IBAN`,
    criticality: "HIGH",
    containsSpecialCategories: false,
  },
  {
    name: "CRM (Salesforce)",
    connectorType: "SALESFORCE",
    description: `${DEMO_TAG} Customer relationship data`,
    criticality: "MEDIUM",
    containsSpecialCategories: false,
  },
  {
    name: "Support Desk (ServiceNow)",
    connectorType: "CUSTOM",
    description: `${DEMO_TAG} Support tickets and customer communications`,
    criticality: "MEDIUM",
    containsSpecialCategories: false,
  },
  {
    name: "Identity Provider (Entra ID)",
    connectorType: "M365",
    description: `${DEMO_TAG} Identity and access management`,
    criticality: "HIGH",
    containsSpecialCategories: false,
  },
  {
    name: "Health & Safety Portal",
    connectorType: "CUSTOM",
    description: `${DEMO_TAG} Occupational health records — Art. 9 data`,
    criticality: "HIGH",
    containsSpecialCategories: true,
  },
  {
    name: "SharePoint Document Hub",
    connectorType: "M365",
    description: `${DEMO_TAG} Corporate file storage — contracts, policies, reports`,
    criticality: "MEDIUM",
    containsSpecialCategories: false,
  },
  {
    name: "M365 Mailbox (Exchange Online)",
    connectorType: "M365",
    description: `${DEMO_TAG} Email and calendar — employee communications`,
    criticality: "HIGH",
    containsSpecialCategories: true,
  },
];

const DATA_CATEGORIES: DataCategory[] = [
  "HR",
  "PAYMENT",
  "CONTACT",
  "COMMUNICATION",
  "IDENTIFICATION",
  "HEALTH",
  "CONTRACT",
  "ONLINE_TECHNICAL",
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}

function randomDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - rand(0, daysBack));
  d.setHours(rand(0, 23), rand(0, 59), rand(0, 59));
  return d;
}

/** Weighted sensitivity: ~40% low, ~35% medium, ~25% high */
function weightedSensitivity(): number {
  const r = Math.random();
  if (r < 0.4) return rand(5, 39);
  if (r < 0.75) return rand(40, 69);
  return rand(70, 95);
}

function sensitivityToSeverity(score: number): FindingSeverity {
  if (score >= 70) return "CRITICAL";
  if (score >= 40) return "WARNING";
  return "INFO";
}

/** Weighted status: ~55% OPEN, ~15% ACCEPTED, ~15% MITIGATING, ~15% MITIGATED */
function weightedStatus(): FindingStatus {
  const r = Math.random();
  if (r < 0.55) return "OPEN";
  if (r < 0.7) return "ACCEPTED";
  if (r < 0.85) return "MITIGATING";
  return "MITIGATED";
}

const FINDINGS_PER_SYSTEM = 20;

/**
 * GET /api/demo/seed-heatmap
 * Returns a hint directing callers to POST.
 */
export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST to seed" });
}

/**
 * POST /api/demo/seed-heatmap
 * Seeds 8 demo systems with 20 findings each for the authenticated tenant.
 * Idempotent: deletes previous [DEMO]-tagged data before re-creating.
 *
 * Protection: only allowed in non-production OR for TENANT_ADMIN / SUPER_ADMIN.
 */
export async function POST() {
  try {
    const user = await requireAuth();

    // Guard: block in production unless the user is TENANT_ADMIN or SUPER_ADMIN
    const isProduction = process.env.NODE_ENV === "production";
    const isAdmin = user.role === "TENANT_ADMIN" || user.role === "SUPER_ADMIN";
    if (isProduction && !isAdmin) {
      throw new ApiError(
        403,
        "Demo seed endpoint is disabled in production for non-admin roles",
      );
    }

    const tenantId = user.tenantId;

    // ── 1. Clean up previous demo data ──────────────────────────────────
    const oldDemoSystems = await prisma.system.findMany({
      where: { tenantId, description: { contains: DEMO_TAG } },
      select: { id: true },
    });
    const oldSystemIds = oldDemoSystems.map((s) => s.id);

    if (oldSystemIds.length > 0) {
      await prisma.finding.deleteMany({
        where: { tenantId, systemId: { in: oldSystemIds } },
      });
    }

    // Delete the demo copilot run + case + data subject (if they exist)
    const oldRun = await prisma.copilotRun.findFirst({
      where: { tenantId, justification: { contains: DEMO_TAG } },
      select: { id: true, caseId: true },
    });
    if (oldRun) {
      await prisma.copilotRun.delete({ where: { id: oldRun.id } });
      const oldCase = await prisma.dSARCase.findFirst({
        where: {
          id: oldRun.caseId,
          tenantId,
          description: { contains: DEMO_TAG },
        },
        select: { id: true, dataSubjectId: true },
      });
      if (oldCase) {
        await prisma.dSARCase.delete({ where: { id: oldCase.id } });
        await prisma.dataSubject
          .delete({ where: { id: oldCase.dataSubjectId } })
          .catch(() => {});
      }
    }

    if (oldSystemIds.length > 0) {
      await prisma.system.deleteMany({
        where: { id: { in: oldSystemIds } },
      });
    }

    // ── 2. Create scaffolding: DataSubject → DSARCase → CopilotRun ─────
    const dataSubject = await prisma.dataSubject.create({
      data: {
        tenantId,
        fullName: "Demo Heatmap Subject",
        email: "demo-heatmap@example.com",
      },
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const dsarCase = await prisma.dSARCase.create({
      data: {
        tenantId,
        caseNumber: `DEMO-HEAT-${Date.now()}`,
        type: "ACCESS",
        status: "DATA_COLLECTION",
        priority: "MEDIUM",
        dueDate,
        description: `${DEMO_TAG} Heatmap demo case`,
        dataSubjectId: dataSubject.id,
        createdByUserId: user.id,
      },
    });

    const copilotRun = await prisma.copilotRun.create({
      data: {
        tenantId,
        caseId: dsarCase.id,
        createdByUserId: user.id,
        status: "COMPLETED",
        justification: `${DEMO_TAG} Heatmap demo run`,
        completedAt: new Date(),
      },
    });

    // ── 3. Create 8 demo systems ────────────────────────────────────────
    const createdSystems: { id: string; name: string }[] = [];
    for (const def of DEMO_SYSTEMS) {
      const sys = await prisma.system.create({
        data: {
          tenantId,
          name: def.name,
          connectorType: def.connectorType,
          description: def.description,
          criticality: def.criticality,
          containsSpecialCategories: def.containsSpecialCategories,
          inScopeForDsar: true,
        },
      });
      createdSystems.push({ id: sys.id, name: sys.name });
    }

    // ── 4. Create 20 findings for each system ───────────────────────────
    let totalFindings = 0;

    for (const sys of createdSystems) {
      const findings = [];

      for (let i = 0; i < FINDINGS_PER_SYSTEM; i++) {
        const sensitivityScore = weightedSensitivity();
        const severity = sensitivityToSeverity(sensitivityScore);
        const status = weightedStatus();
        const category = pick(DATA_CATEGORIES);
        const isSpecial = category === "HEALTH" || Math.random() < 0.2;

        findings.push({
          tenantId,
          caseId: dsarCase.id,
          runId: copilotRun.id,
          systemId: sys.id,
          dataCategory: category,
          sensitivityScore,
          riskScore: sensitivityScore,
          severity,
          status,
          confidence: +(Math.random() * 0.4 + 0.6).toFixed(2),
          containsSpecialCategory: isSpecial,
          summary: `${severity} finding in ${sys.name} — ${category} data (score ${sensitivityScore})`,
          createdAt: randomDate(30),
        });
      }

      await prisma.finding.createMany({ data: findings });
      totalFindings += findings.length;
    }

    // Update run totals
    await prisma.copilotRun.update({
      where: { id: copilotRun.id },
      data: { totalFindings },
    });

    return NextResponse.json({
      ok: true,
      tenantId,
      systemsCreated: createdSystems.length,
      findingsCreated: totalFindings,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
