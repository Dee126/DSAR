export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { linkDsarIncidentSchema } from "@/lib/validation";
import {
  linkDsarToIncident,
  unlinkDsarFromIncident,
  getLinkedIncidentsForCase,
  hasActiveRegulatorTimeline,
} from "@/lib/linkage-service";

/**
 * GET /api/cases/[id]/incidents — Get linked incidents for a case
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_VIEW");

    const links = await getLinkedIncidentsForCase(user.tenantId, params.id);
    const hasRegulatorTimeline = await hasActiveRegulatorTimeline(user.tenantId, params.id);

    return NextResponse.json({
      links,
      hasActiveRegulatorTimeline: hasRegulatorTimeline,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/cases/[id]/incidents — Link a DSAR case to an incident
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_LINK_DSAR");

    const body = await request.json();
    const data = linkDsarIncidentSchema.parse(body);

    const link = await linkDsarToIncident(
      user.tenantId,
      params.id,
      data.incidentId,
      user.id,
      data.linkReason,
      data.subjectInScope as any,
    );

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "incident.dsar_linked",
      entityType: "DsarIncident",
      entityId: link.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        caseId: params.id,
        incidentId: data.incidentId,
        linkReason: data.linkReason,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/cases/[id]/incidents — Unlink a DSAR case from an incident
 * Query: ?incidentId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_LINK_DSAR");

    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get("incidentId");
    if (!incidentId) throw new ApiError(400, "incidentId query parameter is required");

    await unlinkDsarFromIncident(user.tenantId, params.id, incidentId);

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "incident.dsar_unlinked",
      entityType: "DsarIncident",
      entityId: null,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { caseId: params.id, incidentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
