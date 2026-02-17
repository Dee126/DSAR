import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission } from "@/lib/rbac";
import { logAudit, getClientInfo } from "@/lib/audit";
import { ApiError, handleApiError } from "@/lib/errors";
import { updateCaseSchema } from "@/lib/validation";
import { createRequestProfiler, recordEndpointDiagnostics } from "@/lib/query-profiler";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/cases/[id] — Case detail with tab-based lazy loading
 *
 * Query params:
 *   ?include=overview  (default: core data + state transitions)
 *   ?include=tasks
 *   ?include=documents
 *   ?include=comments
 *   ?include=communications
 *   ?include=data-collection
 *   ?include=legal
 *   ?include=all        (legacy: loads everything — heavier)
 *
 * Multiple includes: ?include=tasks,documents
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const profiler = createRequestProfiler();
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "read");

    const url = request.nextUrl;
    const includeParam = url.searchParams.get("include") ?? "overview";
    const includes = new Set(includeParam.split(",").map((s) => s.trim()));
    const loadAll = includes.has("all");

    // Core case data — always loaded (lightweight)
    const caseInclude: Record<string, unknown> = {
      dataSubject: true,
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    };

    // State transitions — included in overview (small, important for timeline)
    if (loadAll || includes.has("overview")) {
      caseInclude.stateTransitions = {
        include: {
          changedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { changedAt: "asc" },
      };
    }

    // Tab-specific includes — only loaded when requested
    if (loadAll || includes.has("tasks")) {
      caseInclude.tasks = {
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      };
    }

    if (loadAll || includes.has("documents")) {
      caseInclude.documents = {
        where: { deletedAt: null },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { uploadedAt: "desc" },
        take: 50,
      };
    }

    if (loadAll || includes.has("comments")) {
      caseInclude.comments = {
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      };
    }

    if (loadAll || includes.has("communications")) {
      caseInclude.communicationLogs = {
        orderBy: { sentAt: "desc" },
        take: 50,
      };
    }

    if (loadAll || includes.has("data-collection")) {
      caseInclude.dataCollectionItems = {
        include: {
          system: {
            select: { id: true, name: true, description: true, owner: true },
          },
        },
        orderBy: { createdAt: "asc" },
      };
    }

    if (loadAll || includes.has("legal")) {
      caseInclude.legalReviews = {
        include: {
          reviewer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      };
    }

    const dsarCase = await prisma.dSARCase.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
      include: caseInclude,
    });

    if (!dsarCase) {
      throw new ApiError(404, "Case not found");
    }

    recordEndpointDiagnostics(`/api/cases/${params.id}`, profiler);

    return NextResponse.json(dsarCase, {
      headers: profiler.getHeaders(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    checkPermission(user.role, "cases", "update");

    const existingCase = await prisma.dSARCase.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenantId,
      },
    });

    if (!existingCase) {
      throw new ApiError(404, "Case not found");
    }

    const body = await request.json();
    const data = updateCaseSchema.parse(body);

    // If assigning to a user, verify they belong to the same tenant
    if (data.assignedToUserId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: data.assignedToUserId,
          tenantId: user.tenantId,
        },
      });
      if (!assignee) {
        throw new ApiError(400, "Assignee not found in your organization");
      }
    }

    const updatedCase = await prisma.dSARCase.update({
      where: { id: params.id },
      data: {
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.assignedToUserId !== undefined && {
          assignedToUserId: data.assignedToUserId,
        }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.lawfulBasis !== undefined && { lawfulBasis: data.lawfulBasis }),
      },
      include: {
        dataSubject: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "case.updated",
      entityType: "DSARCase",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseNumber: existingCase.caseNumber,
        changes: data,
      },
    });

    return NextResponse.json(updatedCase);
  } catch (error) {
    return handleApiError(error);
  }
}
