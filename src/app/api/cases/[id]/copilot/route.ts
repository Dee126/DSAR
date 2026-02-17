import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { checkRateLimit, RUN_COLLECTION_LIMIT } from "@/lib/rate-limit";
import { executeDiscoveryRun } from "@/lib/copilot/discovery";

const createCopilotRunSchema = z.object({
  justification: z.string().min(5, "Justification is required (min 5 chars)"),
  providerSelection: z.array(z.string()).optional(),
  autoStart: z.boolean().default(true),
});

/* -- GET — List all copilot runs for this case ------------------------------ */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");

    const { id: caseId } = await params;

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: caseId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const runs = await prisma.copilotRun.findMany({
      where: {
        caseId,
        tenantId: user.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            findings: true,
            queries: true,
            evidenceItems: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: runs });
  } catch (error) {
    return handleApiError(error);
  }
}

/* -- POST — Create and optionally start a new copilot run ------------------ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "create");

    const { id: caseId } = await params;

    // Rate limit: max runs per case per minute
    const rl = checkRateLimit(`copilot_run:${caseId}`, RUN_COLLECTION_LIMIT);
    if (!rl.allowed) {
      throw new ApiError(
        429,
        `Rate limit exceeded. Try again in ${Math.ceil((rl.retryAfterMs ?? 60000) / 1000)}s.`
      );
    }

    const body = await request.json();
    const data = createCopilotRunSchema.parse(body);

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: caseId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
      include: { dataSubject: true },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    // Determine initial status based on autoStart
    const initialStatus = data.autoStart ? "QUEUED" : "DRAFT";

    // Create CopilotRun record
    const run = await prisma.copilotRun.create({
      data: {
        tenantId: user.tenantId,
        caseId,
        createdByUserId: user.id,
        justification: data.justification,
        providerSelection: data.providerSelection ?? undefined,
        status: initialStatus,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            findings: true,
            queries: true,
            evidenceItems: true,
          },
        },
      },
    });

    // Create or get IdentityProfile from case data subject
    if (dsarCase.dataSubject) {
      const ds = dsarCase.dataSubject;
      const primaryIdentifierType = ds.email ? "EMAIL" : ds.phone ? "PHONE" : "OTHER";
      const primaryIdentifierValue = ds.email ?? ds.phone ?? ds.fullName;

      await prisma.identityProfile.upsert({
        where: {
          tenantId_caseId: {
            tenantId: user.tenantId,
            caseId,
          },
        },
        update: {
          displayName: ds.fullName,
          primaryIdentifierType: primaryIdentifierType as any,
          primaryIdentifierValue: primaryIdentifierValue,
        },
        create: {
          tenantId: user.tenantId,
          caseId,
          displayName: ds.fullName,
          primaryIdentifierType: primaryIdentifierType as any,
          primaryIdentifierValue: primaryIdentifierValue,
          alternateIdentifiers: [],
          confidenceScore: 0,
        },
      });
    }

    // Log audit event
    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "copilot_run.created",
      entityType: "CopilotRun",
      entityId: run.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId,
        caseNumber: dsarCase.caseNumber,
        justification: data.justification,
        autoStart: data.autoStart,
        providerSelection: data.providerSelection,
      },
    });

    // If autoStart, fire-and-forget the discovery run
    if (data.autoStart) {
      executeDiscoveryRun({
        tenantId: user.tenantId,
        caseId,
        runId: run.id,
        userId: user.id,
        justification: data.justification,
        providerSelection: data.providerSelection,
      }).catch((err) => console.error("Discovery run failed:", err));
    }

    return NextResponse.json(run, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
