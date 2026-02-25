import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { hasPermission, checkPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  FindingSeverity,
  FindingStatus,
  DataCategory,
  ConnectorType,
  SystemCriticality,
} from "@prisma/client";
import { scoreFinding } from "@/lib/ai/aiScoringService";

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
  return NextResponse.json({ ok: true, method: "GET", hint: "POST to seed" });
}

/**
 * POST /api/demo/seed-heatmap
 * Seeds 8 demo systems with 20 findings each for the authenticated tenant.
 * Idempotent: deletes previous [DEMO]-tagged data before re-creating.
 *
 * Protection: only allowed in non-production OR for TENANT_ADMIN / SUPER_ADMIN.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    console.log("[seed-heatmap] POST started", {
      userId: user.id,
      userEmail: user.email,
      tenantId: user.tenantId,
      userRole: user.role,
    });

    // Prefer data_inventory "manage" (write equivalent); fall back to "read"
    if (!hasPermission(user.role, "data_inventory", "manage")) {
      checkPermission(user.role, "data_inventory", "read");
    }

    // Always seed into the authenticated user's tenant — never override
    // with DEMO_TENANT_ID, which may reference a non-existent row.
    const tenantId = user.tenantId;

    console.log("[seed-heatmap] tenantId=%s (from session)", tenantId);

    // DEV ONLY: ensure the Tenant row exists so FK writes don't fail with P2003
    if (process.env.NODE_ENV === "development") {
      await prisma.tenant.upsert({
        where: { id: tenantId },
        update: {},
        create: {
          id: tenantId,
          name: "Test Tenant",
        },
      });
      console.log("[seed-heatmap] Tenant ensured (dev upsert) for", tenantId);
    } else {
      // In production, verify the tenant exists — don't auto-create
      const tenantExists = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });
      if (!tenantExists) {
        console.error("[seed-heatmap] Tenant not found:", tenantId);
        return NextResponse.json(
          {
            ok: false,
            error: "Tenant not found",
            tenantId,
            detail: `Tenant "${tenantId}" does not exist in the tenant table. Ensure the user's tenant has been created.`,
          },
          { status: 400 },
        );
      }
    }

    // ── 1. Clean up previous demo data ──────────────────────────────────
    console.log("[seed-heatmap] Step 1: Cleaning up previous demo data");
    const oldDemoSystems = await prisma.system.findMany({
      where: { tenantId, description: { contains: DEMO_TAG } },
      select: { id: true },
    });
    const oldSystemIds = oldDemoSystems.map((s) => s.id);

    if (oldSystemIds.length > 0) {
      console.log("[seed-heatmap] Deleting old findings for", oldSystemIds.length, "demo systems");
      await prisma.finding.deleteMany({
        where: { tenantId, systemId: { in: oldSystemIds } },
      });
    }

    // Delete the demo copilot run + case + data subject (if they exist)
    console.log("[seed-heatmap] Looking for old copilot run to clean up");
    const oldRun = await prisma.copilotRun.findFirst({
      where: { tenantId, justification: { contains: DEMO_TAG } },
      select: { id: true, caseId: true },
    });
    if (oldRun) {
      console.log("[seed-heatmap] Deleting old copilotRun:", oldRun.id, "caseId:", oldRun.caseId);
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
        console.log("[seed-heatmap] Deleting old DSARCase:", oldCase.id, "dataSubjectId:", oldCase.dataSubjectId);
        await prisma.dSARCase.delete({ where: { id: oldCase.id } });
        console.log("[seed-heatmap] Deleting old DataSubject:", oldCase.dataSubjectId);
        await prisma.dataSubject
          .delete({ where: { id: oldCase.dataSubjectId } })
          .catch((e: unknown) => { console.warn("[seed-heatmap] DataSubject delete failed (non-fatal):", e); });
      }
    }

    if (oldSystemIds.length > 0) {
      console.log("[seed-heatmap] Deleting", oldSystemIds.length, "old demo systems");
      await prisma.system.deleteMany({
        where: { id: { in: oldSystemIds } },
      });
    }

    // ── 2. Create scaffolding: DataSubject → DSARCase → CopilotRun ─────
    console.log("[seed-heatmap] Step 2: Creating DataSubject");
    const dataSubject = await prisma.dataSubject.create({
      data: {
        tenantId,
        fullName: "Demo Heatmap Subject",
        email: "demo-heatmap@example.com",
      },
    });

    console.log("[seed-heatmap] DataSubject created:", dataSubject.id);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    console.log("[seed-heatmap] Creating DSARCase");
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

    console.log("[seed-heatmap] DSARCase created:", dsarCase.id);

    console.log("[seed-heatmap] Creating CopilotRun");
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

    console.log("[seed-heatmap] CopilotRun created:", copilotRun.id);

    // ── 3. Create 8 demo systems ────────────────────────────────────────
    console.log("[seed-heatmap] Step 3: Creating", DEMO_SYSTEMS.length, "demo systems");
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

    console.log("[seed-heatmap] Systems created:", createdSystems.length);

    // ── 4. Create 20 findings for each system ───────────────────────────
    console.log("[seed-heatmap] Step 4: Creating findings (", FINDINGS_PER_SYSTEM, "per system )");
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

      console.log("[seed-heatmap] Creating", findings.length, "findings for system:", sys.name);
      await prisma.finding.createMany({ data: findings });
      totalFindings += findings.length;
    }

    // ── 5. AI-score every finding ──────────────────────────────────────
    console.log("[seed-heatmap] Step 5: Scoring findings with AI service");
    const allFindings = await prisma.finding.findMany({
      where: { tenantId, runId: copilotRun.id },
      select: {
        id: true,
        sensitivityScore: true,
        containsSpecialCategory: true,
        dataCategory: true,
      },
    });

    const aiUpdates = allFindings.map((f) => {
      const result = scoreFinding({
        sensitivityScore: f.sensitivityScore,
        containsSpecialCategory: f.containsSpecialCategory,
        dataCategory: f.dataCategory,
      });
      return prisma.finding.update({
        where: { id: f.id },
        data: {
          aiRiskScore: result.aiRiskScore,
          aiConfidence: result.aiConfidence,
          aiSuggestedAction: result.aiSuggestedAction,
          aiLegalReference: result.aiLegalReference,
          aiRationale: result.aiRationale,
          aiReviewStatus: "ANALYZED",
        },
      });
    });

    await Promise.all(aiUpdates);
    console.log("[seed-heatmap] AI scoring complete for", allFindings.length, "findings");

    // Update run totals
    console.log("[seed-heatmap] Updating CopilotRun totalFindings:", totalFindings);
    await prisma.copilotRun.update({
      where: { id: copilotRun.id },
      data: { totalFindings },
    });

    console.log("[seed-heatmap] SUCCESS — seeded", createdSystems.length, "systems,", totalFindings, "findings");

    return NextResponse.json({
      ok: true,
      seededSystems: createdSystems.length,
      seededFindings: totalFindings,
    });
  } catch (err: any) {
    console.error("[seed-heatmap] ERROR", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Internal error",
        name: err?.name,
        code: err?.code,
        meta: err?.meta,
      },
      { status: 500 },
    );
  }
}
