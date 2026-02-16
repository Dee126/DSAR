import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import { createIncidentSchema } from "@/lib/validation";
import { createIncident, listIncidents } from "@/lib/incident-service";
import type { IncidentStatus, IncidentSeverity } from "@prisma/client";

/**
 * GET /api/incidents — List all incidents for tenant
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_VIEW");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as IncidentStatus | null;
    const severity = searchParams.get("severity") as IncidentSeverity | null;
    const regulatorNotified = searchParams.get("regulatorNotified");
    const hasLinkedDsars = searchParams.get("hasLinkedDsars");

    const incidents = await listIncidents(user.tenantId, {
      status: status || undefined,
      severity: severity || undefined,
      regulatorNotified: regulatorNotified !== null ? regulatorNotified === "true" : undefined,
      hasLinkedDsars: hasLinkedDsars !== null ? hasLinkedDsars === "true" : undefined,
    });

    return NextResponse.json(incidents);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/incidents — Create a new incident
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_CREATE");

    const body = await request.json();
    const data = createIncidentSchema.parse(body);

    const incident = await createIncident(user.tenantId, user.id, data);

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "incident.created",
      entityType: "Incident",
      entityId: incident.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { title: incident.title, severity: incident.severity },
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
