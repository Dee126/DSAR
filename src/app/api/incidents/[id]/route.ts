export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError, ApiError } from "@/lib/errors";
import { logAudit, getClientInfo } from "@/lib/audit";
import {
  updateIncidentSchema,
  createIncidentTimelineSchema,
  createIncidentAssessmentSchema,
  createRegulatorRecordSchema,
  updateRegulatorRecordSchema,
  incidentContactSchema,
  incidentCommunicationSchema,
  incidentSystemSchema,
  incidentSourceSchema,
} from "@/lib/validation";
import {
  getIncident,
  updateIncident,
  addTimelineEvent,
  addAssessment,
  addRegulatorRecord,
  updateRegulatorRecord,
  addContact,
  addCommunication,
  addIncidentSystem,
  removeIncidentSystem,
  addIncidentSource,
} from "@/lib/incident-service";

/**
 * GET /api/incidents/[id] — Get incident detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_VIEW");

    const incident = await getIncident(user.tenantId, params.id);
    if (!incident) throw new ApiError(404, "Incident not found");

    return NextResponse.json(incident);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/incidents/[id] — Update incident fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    enforce(user.role, "INCIDENT_UPDATE");

    const body = await request.json();
    const data = updateIncidentSchema.parse(body);

    const incident = await updateIncident(user.tenantId, params.id, data);

    const clientInfo = getClientInfo(request);
    await logAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "incident.updated",
      entityType: "Incident",
      entityId: params.id,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: data,
    });

    return NextResponse.json(incident);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/incidents/[id] — Sub-resource actions
 * Body: { action: "add_timeline" | "add_assessment" | "add_regulator" |
 *          "update_regulator" | "add_contact" | "add_communication" |
 *          "add_system" | "remove_system" | "add_source", ...data }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    const clientInfo = getClientInfo(request);
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      case "add_timeline": {
        enforce(user.role, "INCIDENT_UPDATE");
        const data = createIncidentTimelineSchema.parse(body);
        const event = await addTimelineEvent(user.tenantId, params.id, user.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.timeline_added",
          entityType: "IncidentTimeline",
          entityId: event.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, eventType: data.eventType },
        });

        return NextResponse.json(event, { status: 201 });
      }

      case "add_assessment": {
        enforce(user.role, "INCIDENT_ASSESSMENT");
        const data = createIncidentAssessmentSchema.parse(body);
        const assessment = await addAssessment(user.tenantId, params.id, user.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.assessment_added",
          entityType: "IncidentAssessment",
          entityId: assessment.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, version: assessment.version },
        });

        return NextResponse.json(assessment, { status: 201 });
      }

      case "add_regulator": {
        enforce(user.role, "INCIDENT_UPDATE");
        const data = createRegulatorRecordSchema.parse(body);
        const record = await addRegulatorRecord(user.tenantId, params.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.regulator_record_added",
          entityType: "IncidentRegulatorRecord",
          entityId: record.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, authority: data.authorityName },
        });

        return NextResponse.json(record, { status: 201 });
      }

      case "update_regulator": {
        enforce(user.role, "INCIDENT_UPDATE");
        const recordId = body.recordId as string;
        if (!recordId) throw new ApiError(400, "recordId is required");
        const data = updateRegulatorRecordSchema.parse(body);
        const record = await updateRegulatorRecord(user.tenantId, recordId, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.regulator_record_updated",
          entityType: "IncidentRegulatorRecord",
          entityId: recordId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id },
        });

        return NextResponse.json(record);
      }

      case "add_contact": {
        enforce(user.role, "INCIDENT_UPDATE");
        const data = incidentContactSchema.parse(body);
        const contact = await addContact(user.tenantId, params.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.contact_added",
          entityType: "IncidentContact",
          entityId: contact.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, role: data.role, name: data.name },
        });

        return NextResponse.json(contact, { status: 201 });
      }

      case "add_communication": {
        enforce(user.role, "INCIDENT_UPDATE");
        const data = incidentCommunicationSchema.parse(body);
        const comm = await addCommunication(user.tenantId, params.id, user.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.communication_added",
          entityType: "IncidentCommunication",
          entityId: comm.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, direction: data.direction, channel: data.channel },
        });

        return NextResponse.json(comm, { status: 201 });
      }

      case "add_system": {
        enforce(user.role, "INCIDENT_UPDATE");
        const data = incidentSystemSchema.parse(body);
        const sys = await addIncidentSystem(user.tenantId, params.id, data.systemId, data.notes);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.system_added",
          entityType: "IncidentSystem",
          entityId: sys.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, systemId: data.systemId },
        });

        return NextResponse.json(sys, { status: 201 });
      }

      case "remove_system": {
        enforce(user.role, "INCIDENT_UPDATE");
        const systemId = body.systemId as string;
        if (!systemId) throw new ApiError(400, "systemId is required");
        await removeIncidentSystem(user.tenantId, params.id, systemId);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.system_removed",
          entityType: "IncidentSystem",
          entityId: systemId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, systemId },
        });

        return NextResponse.json({ success: true });
      }

      case "add_source": {
        enforce(user.role, "INCIDENT_UPDATE");
        const data = incidentSourceSchema.parse(body);
        const source = await addIncidentSource(user.tenantId, params.id, data);

        await logAudit({
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "incident.source_added",
          entityType: "IncidentSource",
          entityId: source.id,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { incidentId: params.id, sourceType: data.sourceType },
        });

        return NextResponse.json(source, { status: 201 });
      }

      default:
        throw new ApiError(400, `Unknown action: ${action}`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
