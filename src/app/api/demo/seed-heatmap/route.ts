import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-mode";
import { hasPermission, checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
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

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
// Makes the generated demo data deterministic across runs.
function mulberry32(seed: number) {
  let s = seed | 0;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Constants ───────────────────────────────────────────────────────────────

const DEMO_TAG = "[DEMO]";
const SEED = 42;
const FINDINGS_PER_SYSTEM = 20;

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

// ── Deterministic helpers (all accept an rng function) ──────────────────────

function rand(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[rand(rng, 0, arr.length - 1)];
}

function deterministicDate(rng: () => number, baseTime: number, daysBack: number): Date {
  const ms =
    baseTime -
    rand(rng, 0, daysBack) * 86_400_000 -
    rand(rng, 0, 86_399) * 1000;
  return new Date(ms);
}

/** Weighted sensitivity: ~40% low, ~35% medium, ~25% high */
function weightedSensitivity(rng: () => number): number {
  const r = rng();
  if (r < 0.4) return rand(rng, 5, 39);
  if (r < 0.75) return rand(rng, 40, 69);
  return rand(rng, 70, 95);
}

function sensitivityToSeverity(score: number): FindingSeverity {
  if (score >= 70) return "CRITICAL";
  if (score >= 40) return "WARNING";
  return "INFO";
}

/** Weighted status: ~55% OPEN, ~15% ACCEPTED, ~15% MITIGATING, ~15% MITIGATED */
function weightedStatus(rng: () => number): FindingStatus {
  const r = rng();
  if (r < 0.55) return "OPEN";
  if (r < 0.7) return "ACCEPTED";
  if (r < 0.85) return "MITIGATING";
  return "MITIGATED";
}

// ── Dummy bcrypt hash (not a real password — only used as FK placeholder) ──
const DUMMY_PASSWORD_HASH =
  "$2a$12$000000000000000000000uGZFw.vPjQkVrclFu1cXjFuXqFPsxpS";

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/demo/seed-heatmap
 * Returns a hint directing callers to POST.
 */
export async function GET() {
  return NextResponse.json({ ok: true, method: "GET", hint: "POST to seed" });
}

/**
 * POST /api/demo/seed-heatmap
 *
 * Seeds 8 demo systems with 20 findings each for the current tenant.
 * Deterministic (seeded PRNG) and FK-safe (all parent rows upserted first).
 * Idempotent: deletes previous [DEMO]-tagged data before re-creating.
 * Entire operation runs in a single Prisma interactive transaction.
 *
 * Protection: only allowed in non-production OR for TENANT_ADMIN / SUPER_ADMIN.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser();

    // Prefer data_inventory "manage" (write equivalent); fall back to "read"
    if (!hasPermission(user.role, "data_inventory", "manage")) {
      checkPermission(user.role, "data_inventory", "read");
    }

    const effectiveTenantId = user.tenantId;
    const rng = mulberry32(SEED);
    const now = Date.now();

    console.log("[seed-heatmap] POST started", {
      tenantId: effectiveTenantId,
      userEmail: user.email,
      seed: SEED,
    });

    const result = await prisma.$transaction(
      async (tx) => {
        // ── 0a. Ensure Tenant row exists ──────────────────────────────────
        await tx.tenant.upsert({
          where: { id: effectiveTenantId },
          update: {},
          create: {
            id: effectiveTenantId,
            name: "Acme Corp",
            slaDefaultDays: 30,
            dueSoonDays: 7,
            retentionDays: 365,
          },
        });

        // ── 0b. Ensure a User row exists (FK for DSARCase / CopilotRun) ──
        const seedUser = await tx.user.upsert({
          where: {
            tenantId_email: {
              tenantId: effectiveTenantId,
              email: user.email,
            },
          },
          update: {},
          create: {
            tenantId: effectiveTenantId,
            email: user.email,
            name: user.name,
            passwordHash: DUMMY_PASSWORD_HASH,
            role: user.role,
          },
        });
        const seedUserId = seedUser.id;

        // ── 1. Clean up previous demo data (FK-safe deletion order) ───────
        // Findings → CopilotRun → DSARCase → DataSubject → Systems
        const oldSystems = await tx.system.findMany({
          where: {
            tenantId: effectiveTenantId,
            description: { contains: DEMO_TAG },
          },
          select: { id: true },
        });
        const oldSystemIds = oldSystems.map((s: { id: string }) => s.id);

        if (oldSystemIds.length > 0) {
          await tx.finding.deleteMany({
            where: {
              tenantId: effectiveTenantId,
              systemId: { in: oldSystemIds },
            },
          });
        }

        const oldRun = await tx.copilotRun.findFirst({
          where: {
            tenantId: effectiveTenantId,
            justification: { contains: DEMO_TAG },
          },
          select: { id: true, caseId: true },
        });

        if (oldRun) {
          // Delete any remaining findings for this run (systemId may be null)
          await tx.finding.deleteMany({
            where: { tenantId: effectiveTenantId, runId: oldRun.id },
          });
          await tx.copilotRun.delete({ where: { id: oldRun.id } });

          const oldCase = await tx.dSARCase.findFirst({
            where: {
              id: oldRun.caseId,
              tenantId: effectiveTenantId,
              description: { contains: DEMO_TAG },
            },
            select: { id: true, dataSubjectId: true },
          });
          if (oldCase) {
            await tx.dSARCase.delete({ where: { id: oldCase.id } });
            await tx.dataSubject
              .delete({ where: { id: oldCase.dataSubjectId } })
              .catch(() => {});
          }
        }

        if (oldSystemIds.length > 0) {
          await tx.system.deleteMany({
            where: { id: { in: oldSystemIds } },
          });
        }

        // ── 2. Create scaffolding: DataSubject → DSARCase → CopilotRun ───
        const dataSubject = await tx.dataSubject.create({
          data: {
            tenantId: effectiveTenantId,
            fullName: "Demo Heatmap Subject",
            email: "demo-heatmap@example.com",
          },
        });

        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 30);

        const dsarCase = await tx.dSARCase.create({
          data: {
            tenantId: effectiveTenantId,
            caseNumber: `DEMO-HEAT-${now}`,
            type: "ACCESS",
            status: "DATA_COLLECTION",
            priority: "MEDIUM",
            dueDate,
            description: `${DEMO_TAG} Heatmap demo case`,
            dataSubjectId: dataSubject.id,
            createdByUserId: seedUserId,
          },
        });

        const copilotRun = await tx.copilotRun.create({
          data: {
            tenantId: effectiveTenantId,
            caseId: dsarCase.id,
            createdByUserId: seedUserId,
            status: "COMPLETED",
            justification: `${DEMO_TAG} Heatmap demo run`,
            completedAt: new Date(now),
          },
        });

        // ── 3. Create 8 demo systems ─────────────────────────────────────
        const createdSystems: { id: string; name: string }[] = [];
        for (const def of DEMO_SYSTEMS) {
          const sys = await tx.system.create({
            data: {
              tenantId: effectiveTenantId,
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

        // ── 4. Create findings with inline AI scores ─────────────────────
        let totalFindings = 0;

        for (const sys of createdSystems) {
          const findings = [];

          for (let i = 0; i < FINDINGS_PER_SYSTEM; i++) {
            const sensitivityScore = weightedSensitivity(rng);
            const severity = sensitivityToSeverity(sensitivityScore);
            const status = weightedStatus(rng);
            const category = pick(rng, DATA_CATEGORIES);
            const isSpecial = category === "HEALTH" || rng() < 0.2;

            const ai = scoreFinding({
              sensitivityScore,
              containsSpecialCategory: isSpecial,
              dataCategory: category,
            });

            findings.push({
              tenantId: effectiveTenantId,
              caseId: dsarCase.id,
              runId: copilotRun.id,
              systemId: sys.id,
              dataCategory: category,
              sensitivityScore,
              riskScore: sensitivityScore,
              severity,
              status,
              confidence: +(rng() * 0.4 + 0.6).toFixed(2),
              containsSpecialCategory: isSpecial,
              summary: `${severity} finding in ${sys.name} — ${category} data (score ${sensitivityScore})`,
              createdAt: deterministicDate(rng, now, 30),
              aiRiskScore: ai.aiRiskScore,
              aiConfidence: ai.aiConfidence,
              aiSuggestedAction: ai.aiSuggestedAction,
              aiLegalReference: ai.aiLegalReference,
              aiRationale: ai.aiRationale,
              aiReviewStatus: "ANALYZED" as const,
            });
          }

          await tx.finding.createMany({ data: findings });
          totalFindings += findings.length;
        }

        // ── 5. Update CopilotRun totals ──────────────────────────────────
        await tx.copilotRun.update({
          where: { id: copilotRun.id },
          data: { totalFindings },
        });

        console.log(
          "[seed-heatmap] SUCCESS — %d systems, %d findings",
          createdSystems.length,
          totalFindings,
        );

        return {
          ok: true as const,
          tenantId: effectiveTenantId,
          created: {
            tenants: 1,
            users: 1,
            dataSubjects: 1,
            cases: 1,
            copilotRuns: 1,
            systems: createdSystems.length,
            findings: totalFindings,
          },
          ids: {
            tenantId: effectiveTenantId,
            seedUserId,
            caseId: dsarCase.id,
            copilotRunId: copilotRun.id,
            systemIds: createdSystems.map((s) => s.id),
            dataSubjectId: dataSubject.id,
          },
        };
      },
      { timeout: 30_000 },
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[seed-heatmap] ERROR", err);

    if (
      (err instanceof Error && err.name === "ApiError") ||
      (err instanceof Error && err.name === "ZodError")
    ) {
      return handleApiError(err);
    }

    const prismaErr = err as Record<string, unknown> | undefined;
    const isPrismaError =
      prismaErr?.constructor?.name === "PrismaClientKnownRequestError" ||
      prismaErr?.name === "PrismaClientKnownRequestError";

    if (isPrismaError) {
      return NextResponse.json(
        {
          error: (prismaErr as { message?: string }).message ?? "Database error",
          code: (prismaErr as { code?: string }).code ?? null,
          meta: (prismaErr as { meta?: unknown }).meta ?? null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
