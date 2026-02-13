import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { executeDiscoveryRun } from "@/lib/copilot/discovery";

interface RouteParams {
  params: { id: string };
}

const createCopilotRunSchema = z.object({
  reason: z.string().min(5).max(2000),
});

/* -- GET — List all copilot runs for this case ------------------------------ */

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "read");

    // Verify case exists in tenant
    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    const runs = await prisma.copilotRun.findMany({
      where: {
        caseId: params.id,
        tenantId: user.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { findings: true, queries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: runs });
  } catch (error) {
    return handleApiError(error);
  }
}

/* -- POST — Create and start a new copilot run ----------------------------- */

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "copilot", "create");

    // Rate limit: max 3 copilot runs per case per minute
    const rl = checkRateLimit(`copilot:${params.id}`, {
      maxRequests: 3,
      windowMs: 60_000,
    });
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
        id: params.id,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    // Create CopilotRun record with initial status
    const run = await prisma.copilotRun.create({
      data: {
        tenantId: user.tenantId,
        caseId: params.id,
        createdByUserId: user.id,
        reason: data.reason,
        status: "CREATED",
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { findings: true, queries: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "COPILOT_RUN_CREATED",
      entityType: "CopilotRun",
      entityId: run.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        caseNumber: dsarCase.caseNumber,
        reason: data.reason,
      },
    });

    // Fire and forget — run updates its own status
    executeDiscoveryRun({
      tenantId: user.tenantId,
      caseId: params.id,
      runId: run.id,
      userId: user.id,
      reason: data.reason,
    }).catch((err) => console.error("Discovery run failed:", err));

    return NextResponse.json(run, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
