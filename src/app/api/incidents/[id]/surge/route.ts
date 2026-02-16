import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { createSurgeGroupSchema, surgeGroupBulkActionSchema } from "@/lib/validation";
import {
  createSurgeGroup,
  getSurgeGroup,
  addCasesToSurgeGroup,
  bulkApplySystems,
  bulkCreateTasks,
  bulkCreateExtensionNotices,
} from "@/lib/surge-service";

/**
 * GET /api/incidents/[id]/surge — List surge groups for incident
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_VIEW");

    const { searchParams } = new URL(request.url);
    const surgeGroupId = searchParams.get("surgeGroupId");

    if (surgeGroupId) {
      const group = await getSurgeGroup(user.tenantId, surgeGroupId);
      if (!group) throw new ApiError(404, "Surge group not found");
      return NextResponse.json(group);
    }

    // List all surge groups for this incident
    const { prisma } = await import("@/lib/prisma");
    const groups = await prisma.surgeGroup.findMany({
      where: { tenantId: user.tenantId, incidentId: params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(groups);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/incidents/[id]/surge — Create surge group or bulk actions
 * Body: { action: "create" | "add_cases" | "bulk_action", ...data }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_SURGE_MANAGE");

    const clientInfo = getClientInfo(request);
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case "create": {
        const data = createSurgeGroupSchema.parse(body);
        const group = await createSurgeGroup(
          user.tenantId,
          params.id,
          user.id,
          data.name,
          data.description,
          data.caseIds,
        );

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.surge_group_created",
          entityType: "SurgeGroup",
          entityId: group?.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, name: data.name, caseCount: data.caseIds?.length || 0 },
        });

        return NextResponse.json(group, { status: 201 });
      }

      case "add_cases": {
        const surgeGroupId = body.surgeGroupId as string;
        const caseIds = body.caseIds as string[];
        if (!surgeGroupId || !caseIds?.length) {
          throw new ApiError(400, "surgeGroupId and caseIds are required");
        }

        const count = await addCasesToSurgeGroup(user.tenantId, surgeGroupId, caseIds);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.surge_cases_added",
          entityType: "SurgeGroup",
          entityId: surgeGroupId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, casesAdded: caseIds.length },
        });

        return NextResponse.json({ totalMembers: count });
      }

      case "bulk_action": {
        const surgeGroupId = body.surgeGroupId as string;
        if (!surgeGroupId) throw new ApiError(400, "surgeGroupId is required");

        const data = surgeGroupBulkActionSchema.parse(body);

        let result: Record<string, unknown>;

        switch (data.action) {
          case "apply_systems": {
            if (!data.systemIds?.length) throw new ApiError(400, "systemIds required");
            result = await bulkApplySystems(user.tenantId, surgeGroupId, data.systemIds);
            break;
          }
          case "create_tasks": {
            if (!data.taskTitle) throw new ApiError(400, "taskTitle required");
            result = await bulkCreateTasks(user.tenantId, surgeGroupId, data.taskTitle, data.taskDescription);
            break;
          }
          case "create_extension_notices": {
            if (!data.extensionDays || !data.extensionReason) {
              throw new ApiError(400, "extensionDays and extensionReason required");
            }
            result = await bulkCreateExtensionNotices(
              user.tenantId,
              surgeGroupId,
              data.extensionDays,
              data.extensionReason,
            );
            break;
          }
          case "set_template": {
            // Store template suggestion on surge group
            const { prisma } = await import("@/lib/prisma");
            await prisma.surgeGroup.update({
              where: { id: surgeGroupId },
              data: { suggestedTemplate: data.templateId },
            });
            result = { success: true, templateId: data.templateId };
            break;
          }
          default:
            throw new ApiError(400, `Unknown bulk action: ${data.action}`);
        }

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: `incident.surge_bulk_${data.action}`,
          entityType: "SurgeGroup",
          entityId: surgeGroupId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, bulkAction: data.action, result },
        });

        return NextResponse.json(result);
      }

      default:
        throw new ApiError(400, `Unknown action: ${action}`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
